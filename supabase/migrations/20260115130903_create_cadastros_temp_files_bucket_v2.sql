/*
  # Create Storage Bucket for Temporary Cadastro Files

  1. New Bucket
    - `cadastros-temp-files` bucket for storing temporary files during cadastro process
    - Files are stored temporarily until cadastro is completed
    - After successful ERP submission, files are deleted to free up space
  
  2. Security
    - Policies for authenticated users to upload, read, and delete files
  
  3. Configuration
    - Maximum file size: 10MB
    - Allowed MIME types: PDF, JPEG, PNG
    - Public: false (only authenticated users)
*/

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cadastros-temp-files',
  'cadastros-temp-files',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload cadastro files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cadastros-temp-files');

-- Policy: Authenticated users can read files
CREATE POLICY "Authenticated users can read cadastro files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'cadastros-temp-files');

-- Policy: Authenticated users can delete files
CREATE POLICY "Authenticated users can delete cadastro files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'cadastros-temp-files');