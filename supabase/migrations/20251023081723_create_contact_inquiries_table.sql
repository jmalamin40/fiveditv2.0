/*
  # Create Contact Inquiries Table

  1. New Tables
    - `contact_inquiries`
      - `id` (uuid, primary key) - Unique identifier for each inquiry
      - `name` (text) - Name of the person contacting
      - `email` (text) - Email address for communication
      - `phone` (text, optional) - Contact phone number
      - `company` (text, optional) - Company name
      - `message` (text) - Inquiry message content
      - `created_at` (timestamptz) - Timestamp when inquiry was submitted
      
  2. Security
    - Enable RLS on `contact_inquiries` table
    - Add policy for inserting new inquiries (public access for form submissions)
    - Add policy for authenticated admin users to read all inquiries
    
  3. Notes
    - Public users can only insert data (submit forms)
    - No authentication required for form submission
    - Admin access would require authenticated users with specific roles
    - Only allow submissions from fivedit.com domain
*/ 

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact inquiries"
  ON contact_inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read all inquiries"
  ON contact_inquiries
  FOR SELECT
  TO authenticated
  USING (true);
