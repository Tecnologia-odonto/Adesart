/*
  # Populate Planos Map

  1. Changes
    - Inserts all available planos into cadastro_planos_map table
    - Maps plano_id to display names and ANS registration codes
    - Sets default regra_valor as 'titular' for all plans
    - All plans are set as active by default

  2. Data Structure
    - plano_id: ERP plan ID
    - nome_exibicao: Display name for the plan
    - registro_produto: ANS registration code
    - regra_valor: 'titular' (default pricing rule)
    - ativo: true (all plans active)
*/

-- Insert all planos
INSERT INTO cadastro_planos_map (plano_id, nome_exibicao, registro_produto, regra_valor, ativo) VALUES
  (23, 'CONSULTORIO PARCERIA', NULL, 'titular', true),
  (5, 'CORTESIA PJ', '441120030', 'titular', true),
  (140, 'CORTESIA PJ ODONTOART', '468945133', 'titular', true),
  (41, 'MULTIMASTER BRASIL EMP1-REG. PROD. 479066179', '479066179', 'titular', true),
  (44, 'MULTIMASTER BRASIL- I.F .-REG. PROD. 479065171', '479065171', 'titular', true),
  (42, 'MULTIMASTER GR2-C.O.-REG. PROD. 477720174', '477720174', 'titular', true),
  (47, 'MULTIMASTER PF - SP', '477718172', 'titular', true),
  (52, 'MULTIMASTER PF-CUPOM DESCONTO', '468948138', 'titular', true),
  (17, 'MULTIMASTER PF-REG. PROD. 468948138', '468948138', 'titular', true),
  (24, 'MULTIMASTER PJ 2', '468945133', 'titular', true),
  (45, 'MULTIMASTER PJ DNOCS', '468945133', 'titular', true),
  (37, 'MULTIMASTER PJ MIGRACAO 2', '468945133', 'titular', true),
  (25, 'MULTIMASTER PJ SINDASP', '468945133', 'titular', true),
  (20, 'MULTIMASTER PJ-REG. PROD. 468945133', '468945133', 'titular', true),
  (55, 'MULTIMASTER PJ-REG. PROD. 468945133 - MEI E PME', '468945133', 'titular', true),
  (46, 'MULTIPLUS GOIAS', '479065171', 'titular', true),
  (28, 'MULTIPLUS PF ANUAL', '468950130', 'titular', true),
  (16, 'MULTIPLUS PF-REG. PROD. 468950130', '468950130', 'titular', true),
  (36, 'MULTIPLUS PJ 15 DIAS', '468946131', 'titular', true),
  (19, 'MULTIPLUS PJ-REG. PROD. 468946131', '468946131', 'titular', true),
  (54, 'MULTIPLUS PJ-REG. PROD. 468946131 - MEI E PME', '468946131', 'titular', true),
  (27, 'MULTIPREV PF ANUAL', '468949136', 'titular', true),
  (15, 'MULTIPREV PF-REG. PROD. 468949136', '468949136', 'titular', true),
  (18, 'MULTIPREV PJ-REG. PROD. 468947130', '468947130', 'titular', true),
  (53, 'MULTIPREV PJ-REG. PROD. 468947130 - MEI E PME', '468947130', 'titular', true),
  (4, 'ORTODONTIA', NULL, 'titular', true),
  (11, 'ORTODONTIA/CONTENCAO', NULL, 'titular', true),
  (3, 'PARTICULAR', NULL, 'titular', true),
  (12, 'PLANO COELCE', '441119036', 'titular', true),
  (26, 'PLANO ESPECIAL DE ORTODONTIA', '468951138', 'titular', true),
  (1, 'PLANO ODONTOART PF INDIVIDUAL', '441119036', 'titular', true),
  (2, 'PLANO ODONTOART PJ INDIVIDUAL', '441120030', 'titular', true),
  (21, 'PREFEITURA DE SOBRAL', '441120030', 'titular', true),
  (30, 'VECTOR CIOPS/SSPDS', '468946131', 'titular', true),
  (31, 'VECTOR COMPULSORIO', '468946131', 'titular', true),
  (40, 'MULTIMASTER GR3-REG. PROD. 477719171', '477719171', 'titular', true),
  (131, 'ADESAO - MAG MASTER GOLD', '481407180', 'titular', true),
  (101, 'DME - EMPRESA DENTAL MASTER', '415086994', 'titular', true),
  (111, 'DME - EMPRESA DENTAL MASTER FAM', '415086994', 'titular', true),
  (120, 'DME-1 FAMILIA', '415086994', 'titular', true),
  (108, 'INDIVIDUAL MASTER PREMIUM', '462686109', 'titular', true),
  (130, 'INDIVIDUAL MASTER VIP', '480579188', 'titular', true),
  (105, 'M - MASTER', '436998020', 'titular', true),
  (106, 'ME - MASTER ESPECIAL', '415086994', 'titular', true),
  (114, 'ME - MASTER ESPECIAL FAM', '415086994', 'titular', true),
  (121, 'ME-1', '415086994', 'titular', true),
  (122, 'ME-1 FAMILIA', '415086994', 'titular', true),
  (110, 'MEE - MASTER ESPECIAL EMPRESA', '476334163', 'titular', true),
  (118, 'MEE - MASTER ESPECIAL EMPRESA FAM', '476334163', 'titular', true),
  (138, 'MEE C - MASTER ESPECIAL EMPRESA', '476334163', 'titular', true),
  (139, 'MEE C - MASTER ESPECIAL EMPRESA - FAM', '476334163', 'titular', true),
  (136, 'MFM- MASTER FLEX MISTO URGENCIA', '488688217', 'titular', true),
  (109, 'MPE - MASTER PREMIUM EMPRESA', '476101164', 'titular', true),
  (117, 'MPE - MASTER PREMIUM EMPRESA FAM', '476101164', 'titular', true),
  (126, 'MPE-1', '476101164', 'titular', true),
  (107, 'PRE - MASTER PREMIUM', '436998020', 'titular', true),
  (115, 'PRE - MASTER PREMIUM FAM', '436998020', 'titular', true),
  (124, 'PRE-1', '436998020', 'titular', true),
  (125, 'PRE-1 FAMILIA', '436998020', 'titular', true),
  (51, 'CORTESIA PF', '441119036', 'titular', true),
  (48, 'MULTI HELP CL ADESÃO', '490469219', 'titular', true),
  (49, 'MULTI HELP CL EMPRESARIAL', '490470212', 'titular', true),
  (50, 'MULTI HELP PESSOA FÍSICA', '490468211', 'titular', true),
  (39, 'MULTIMASTER BRASIL EMP-REG. PROD. 479066179', '479066179', 'titular', true),
  (43, 'MULTIMASTER GR- I.F .-REG. PROD. 477718172', '477718172', 'titular', true),
  (38, 'MULTIMASTER GR1 EMPRESARIAL-REG. PROD. 477719171', '477719171', 'titular', true),
  (29, 'MULTIMASTER PF ANUAL', '468948138', 'titular', true),
  (32, 'MULTIMASTER PF MIGRACAO', '468948138', 'titular', true),
  (34, 'MULTIMASTER PF MIGRACAO 2-REG. PROD. 468948138', '468948138', 'titular', true),
  (22, 'MULTIMASTER PJ 1', '468945133', 'titular', true),
  (35, 'MULTIMASTER PJ 15 DIAS', '468945133', 'titular', true),
  (33, 'MULTIPLUS PF MIGRACAO', '468950130', 'titular', true),
  (13, 'PLANO PF CARENCIA', '441119036', 'titular', true),
  (14, 'PLANO PJ CARENCIA', '441120030', 'titular', true)
ON CONFLICT (plano_id) DO UPDATE SET
  nome_exibicao = EXCLUDED.nome_exibicao,
  registro_produto = EXCLUDED.registro_produto,
  regra_valor = EXCLUDED.regra_valor,
  ativo = EXCLUDED.ativo,
  updated_at = now();
