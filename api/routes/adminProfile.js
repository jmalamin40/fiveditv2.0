const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.user.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `admin_${userId}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get current admin profile
router.get('/profile', authenticate, requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const [users] = await pool.execute(
      'SELECT id, name, email, profile_picture, created_at FROM users WHERE id = ?',
      [adminId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    // Convert relative path to full URL if profile_picture exists
    let profilePictureUrl = null;
    if (user.profile_picture) {
      if (user.profile_picture.startsWith('http')) {
        profilePictureUrl = user.profile_picture;
      } else {
        // Construct URL based on request origin or environment variable
        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${process.env.PORT || 3004}`;
        const baseUrl = process.env.API_BASE_URL || `${protocol}://${host}`;
        profilePictureUrl = `${baseUrl}/uploads/profiles/${path.basename(user.profile_picture)}`;
      }
    }
    
    res.json({
      ...user,
      profile_picture: profilePictureUrl
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Upload profile picture
router.post('/profile/picture', authenticate, requireAdmin, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const adminId = req.user.id;
    const filename = req.file.filename;
    
    // Get old profile picture to delete it later
    const [users] = await pool.execute(
      'SELECT profile_picture FROM users WHERE id = ?',
      [adminId]
    );
    
    // Update user profile picture
    await pool.execute(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      [filename, adminId]
    );
    
    // Delete old profile picture if it exists
    if (users.length > 0 && users[0].profile_picture) {
      const oldFilePath = path.join(__dirname, '../../uploads/profiles', users[0].profile_picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Return the new profile picture URL
    // Construct URL based on request origin or environment variable
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3004}`;
    const baseUrl = process.env.API_BASE_URL || `${protocol}://${host}`;
    const profilePictureUrl = `${baseUrl}/uploads/profiles/${filename}`;
    
    res.json({
      success: true,
      profile_picture: profilePictureUrl
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Get active admins with profile pictures
router.get('/active-admins', async (req, res) => {
  try {
    // Get admins who are online (last seen within 30 seconds)
    // Use GROUP BY to ensure unique admins even if multiple status entries exist
    const [admins] = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        MAX(uos.last_seen) as last_seen
      FROM users u
      INNER JOIN user_online_status uos ON u.id = uos.user_id
      WHERE u.role = 'admin'
      AND uos.user_type = 'admin'
      AND uos.is_online = TRUE
      AND TIMESTAMPDIFF(SECOND, uos.last_seen, NOW()) <= 30
      GROUP BY u.id, u.name, u.email, u.profile_picture
      ORDER BY last_seen DESC`
    );
    
    // Format profile picture URLs
    // Construct URL based on request origin or environment variable
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3004}`;
    const baseUrl = process.env.API_BASE_URL || `${protocol}://${host}`;
    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      profile_picture: admin.profile_picture 
        ? (admin.profile_picture.startsWith('http') 
            ? admin.profile_picture 
            : `${baseUrl}/uploads/profiles/${path.basename(admin.profile_picture)}`)
        : null,
      last_seen: admin.last_seen
    }));
    
    // Deduplicate by ID (safety check in case GROUP BY didn't work)
    const uniqueAdmins = formattedAdmins.filter((admin, index, self) => 
      index === self.findIndex(a => a.id === admin.id)
    );
    
    res.json({
      count: uniqueAdmins.length,
      admins: uniqueAdmins
    });
  } catch (error) {
    console.error('Error fetching active admins:', error);
    res.status(500).json({ error: 'Failed to fetch active admins' });
  }
});

module.exports = router;
