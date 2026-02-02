import { useState, useEffect } from 'react';
import { User, Upload, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { fetchAdminProfile, uploadProfilePicture } from '../api';

interface ProfileManagerProps {
  token: string;
}

interface AdminProfile {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  created_at: string;
}

export default function ProfileManager({ token }: ProfileManagerProps) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [token]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAdminProfile(token);
      setProfile(data);
      if (data.profile_picture) {
        setPreview(data.profile_picture);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadStatus('error');
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadStatus('error');
        alert('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      setUploadStatus('idle');
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadStatus('idle');

      const formData = new FormData();
      formData.append('profilePicture', selectedFile);

      const result = await uploadProfilePicture(token, formData);
      
      setProfile(prev => prev ? { ...prev, profile_picture: result.profile_picture } : null);
      setUploadStatus('success');
      setSelectedFile(null);
      
      // Reload profile to get updated data
      setTimeout(() => {
        loadProfile();
        setUploadStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-manager">
        <div className="loading-state">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-manager">
        <div className="empty-state">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="profile-manager">
      <div className="profile-header">
        <User size={24} />
        <h1>My Profile</h1>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <h2>Profile Information</h2>
          <div className="profile-info">
            <div className="info-item">
              <label>Name</label>
              <div className="info-value">{profile.name}</div>
            </div>
            <div className="info-item">
              <label>Email</label>
              <div className="info-value">{profile.email}</div>
            </div>
            <div className="info-item">
              <label>Member Since</label>
              <div className="info-value">
                {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2>Profile Picture</h2>
          <div className="profile-picture-section">
            <div className="profile-picture-preview">
              {preview ? (
                <img src={preview} alt="Profile" className="profile-image" />
              ) : (
                <div className="profile-placeholder">
                  <User size={48} />
                </div>
              )}
              <div className="profile-overlay">
                <label htmlFor="profile-upload" className="upload-button">
                  <Camera size={20} />
                  <span>Change Photo</span>
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="file-input"
                />
              </div>
            </div>

            {selectedFile && (
              <div className="upload-actions">
                <div className="file-info">
                  <span>{selectedFile.name}</span>
                  <span className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn-primary"
                >
                  {isUploading ? 'Uploading...' : 'Upload Picture'}
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(profile.profile_picture);
                    setUploadStatus('idle');
                  }}
                  disabled={isUploading}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            )}

            {uploadStatus === 'success' && (
              <div className="status-message success">
                <CheckCircle size={16} />
                <span>Profile picture updated successfully!</span>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="status-message error">
                <AlertCircle size={16} />
                <span>Failed to upload profile picture. Please try again.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .profile-manager {
          padding: 2rem;
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .profile-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
        }

        .profile-content {
          display: grid;
          gap: 2rem;
        }

        .profile-section {
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          padding: 1.5rem;
        }

        .profile-section h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-item label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
        }

        .info-value {
          font-size: 1rem;
          color: #111827;
        }

        .profile-picture-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.5rem;
        }

        .profile-picture-preview {
          position: relative;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #e5e7eb;
        }

        .profile-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-placeholder {
          width: 100%;
          height: 100%;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
        }

        .profile-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .profile-picture-preview:hover .profile-overlay {
          opacity: 1;
        }

        .upload-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: white;
          color: #111827;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .upload-button:hover {
          background: #f9fafb;
        }

        .file-input {
          display: none;
        }

        .upload-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          max-width: 400px;
        }

        .file-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .file-size {
          color: #6b7280;
        }

        .btn-primary {
          padding: 0.75rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 0.75rem 1.5rem;
          background-color: #f3f4f6;
          color: #111827;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #e5e7eb;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .status-message.success {
          background: #d1fae5;
          color: #065f46;
        }

        .status-message.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .loading-state, .empty-state {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}


