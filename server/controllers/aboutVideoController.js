const AboutVideo = require('../models/AboutVideo');
const https = require('https');

// Helper to fetch YouTube video duration
const fetchYoutubeDuration = (videoUrl) => {
  return new Promise((resolve, reject) => {
    try {
      // Extract Video ID
      const videoIdMatch = videoUrl.match(/(?:embed\/|v=|\/v\/|youtu\.be\/)([^&\n?#]+)/);
      if (!videoIdMatch || !videoIdMatch[1]) {
        return resolve('2:15'); // Fallback if not a valid YT URL
      }
      
      const videoId = videoIdMatch[1];
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      https.get(watchUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const match = data.match(/"lengthSeconds":"(\d+)"/);
          if(match && match[1]) {
              const seconds = parseInt(match[1]);
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              resolve(`${mins}:${secs.toString().padStart(2, '0')}`);
          } else {
              // Try secondary regex for meta tag
              const metaMatch = data.match(/<meta itemprop="duration" content="PT(\d+M\d+S)">/);
              if (metaMatch && metaMatch[1]) {
                const durationStr = metaMatch[1]; // e.g. "2M15S"
                const mMatch = durationStr.match(/(\d+)M/);
                const sMatch = durationStr.match(/(\d+)S/);
                const m = mMatch ? parseInt(mMatch[1]) : 0;
                const s = sMatch ? parseInt(sMatch[1]) : 0;
                resolve(`${m}:${s.toString().padStart(2, '0')}`);
              } else {
                resolve('2:15'); // Fallback
              }
          }
        });
      }).on('error', (err) => {
        console.error('Failed to fetch YouTube duration:', err);
        resolve('2:15'); // Fallback on error
      });
    } catch (err) {
      console.error('Error in fetchYoutubeDuration:', err);
      resolve('2:15');
    }
  });
};

// @desc    Get About Video Content
// @route   GET /api/content/about-video
// @access  Public
const getAboutVideo = async (req, res) => {
  try {
    let content = await AboutVideo.findOne();
    
    // Seed default if it doesn't exist
    if (!content) {
      content = await AboutVideo.create({});
    }

    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch about video content' });
  }
};

// @desc    Update About Video Content
// @route   PUT /api/content/admin/about-video
// @access  Private/Admin
const updateAboutVideo = async (req, res) => {
  try {
    let content = await AboutVideo.findOne();
    
    let newDuration = content ? content.duration : '2:15';

    // If URL is changed, fetch the new duration
    if (!content || content.videoUrl !== req.body.videoUrl) {
       newDuration = await fetchYoutubeDuration(req.body.videoUrl);
    }

    const updateData = {
      ...req.body,
      duration: newDuration
    };

    if (content) {
      content = await AboutVideo.findOneAndUpdate({}, updateData, { new: true });
    } else {
      content = await AboutVideo.create(updateData);
    }

    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update about video content' });
  }
};

module.exports = {
  getAboutVideo,
  updateAboutVideo
};
