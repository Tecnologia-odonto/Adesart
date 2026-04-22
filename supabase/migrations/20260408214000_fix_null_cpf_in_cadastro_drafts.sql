/*
  Prevent duplicate "cadastro" drafts caused by null CPF values.

  What this migration does:
  1) Removes duplicate incomplete cadastro rows that point to the same CPF
     (using top-level CPF or titular/dependente CPF when top-level is empty).
  2) Backfills missing top-level CPF from dependentes array when possible.
  3) Adds a trigger to enforce/normalize CPF for tipo_cadastro='cadastro'
     on every INSERT/UPDATE.
*/

-- 1) Remove duplicate incomplete cadastro rows by normalized CPF key
WITH normalized AS (
  SELECT
    c.id,
    c.updated_at,
    c.created_at,
    regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') AS cpf_top,
    (
      SELECT regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')
      FROM jsonb_array_elements(c.dependentes) dep
      WHERE length(regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')) = 11
      ORDER BY CASE WHEN dep->>'tipo' = '1' THEN 0 ELSE 1 END
      LIMIT 1
    ) AS cpf_dep
  FROM cadastros c
  WHERE c.tipo_cadastro = 'cadastro'
    AND c.status = 'incompleto'
),
ranked AS (
  SELECT
    id,
    COALESCE(NULLIF(cpf_top, ''), NULLIF(cpf_dep, '')) AS cpf_key,
    row_number() OVER (
      PARTITION BY COALESCE(NULLIF(cpf_top, ''), NULLIF(cpf_dep, ''))
      ORDER BY
        CASE WHEN cpf_top <> '' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM normalized
  WHERE COALESCE(NULLIF(cpf_top, ''), NULLIF(cpf_dep, '')) IS NOT NULL
)
DELETE FROM cadastros c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- 2) Backfill missing top-level CPF from dependentes
WITH extracted AS (
  SELECT
    c.id,
    (
      SELECT regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')
      FROM jsonb_array_elements(c.dependentes) dep
      WHERE length(regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')) = 11
      ORDER BY CASE WHEN dep->>'tipo' = '1' THEN 0 ELSE 1 END
      LIMIT 1
    ) AS cpf_from_dep
  FROM cadastros c
  WHERE c.tipo_cadastro = 'cadastro'
    AND regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') = ''
    AND c.dependentes IS NOT NULL
    AND jsonb_typeof(c.dependentes) = 'array'
)
UPDATE cadastros c
SET cpf = e.cpf_from_dep
FROM extracted e
WHERE c.id = e.id
  AND length(COALESCE(e.cpf_from_dep, '')) = 11;

-- 3) Enforce CPF consistency for tipo_cadastro='cadastro'
CREATE OR REPLACE FUNCTION enforce_cadastro_cpf_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cpf text := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
  v_cpf_dep text;
BEGIN
  IF NEW.tipo_cadastro = 'cadastro' THEN
    -- Keep existing CPF on updates when incoming payload sends empty/null.
    IF length(v_cpf) <> 11 AND TG_OP = 'UPDATE' THEN
      v_cpf := regexp_replace(COALESCE(OLD.cpf, ''), '\D', '', 'g');
    END IF;

    -- Last fallback: infer CPF from dependentes array (prefer titular tipo=1).
    IF length(v_cpf) <> 11
       AND NEW.dependentes IS NOT NULL
       AND jsonb_typeof(NEW.dependentes) = 'array' THEN
      SELECT regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')
      INTO v_cpf_dep
      FROM jsonb_array_elements(NEW.dependentes) dep
      WHERE length(regexp_replace(COALESCE(dep->>'cpf', ''), '\D', '', 'g')) = 11
      ORDER BY CASE WHEN dep->>'tipo' = '1' THEN 0 ELSE 1 END
      LIMIT 1;

      v_cpf := COALESCE(v_cpf_dep, '');
    END IF;

    IF length(v_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF is required for tipo_cadastro=cadastro'
        USING ERRCODE = '23514';
    END IF;

    NEW.cpf := v_cpf;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cadastro_cpf_consistency_trigger ON cadastros;
CREATE TRIGGER enforce_cadastro_cpf_consistency_trigger
  BEFORE INSERT OR UPDATE ON cadastros
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cadastro_cpf_consistency();

COMMENT ON FUNCTION enforce_cadastro_cpf_consistency IS
  'Guarantees a valid top-level CPF for tipo_cadastro=cadastro by normalizing, preserving OLD.cpf, or inferring from dependentes.';
