const Application = require('../models/Application');
const Job = require('../models/Job');
const { deleteFromCloudinary } = require('../utils/cloudinary');
const { applicationSchema } = require('../validators/applicationValidator');

// Submit a new application (Public)
exports.createApplication = async (req, res) => {
  try {
    // 1. Zod Validation
    try {
      await applicationSchema.parseAsync(req.body);
    } catch (validationError) {
      // If validation fails, delete the uploaded file from Cloudinary
      if (req.file) {
        try {
          await deleteFromCloudinary(req.file.filename, true);
        } catch (err) {
          console.error("Failed to delete file after validation error", err);
        }
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationError.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }

    const {
      jobId,
      fullName,
      email,
      phone,
      experienceYears,
      currentCTC,
      expectedCTC,
      noticePeriod,
      linkedinUrl,
      portfolioUrl,
      coverLetter
    } = req.body;

    // Check if resume file is present
    if (!req.file) {
      return res.status(400).json({ message: 'Resume is required.' });
    }

    // Verify Job exists if jobId is provided and not 'general'
    if (jobId && jobId !== 'general') {
      const jobExists = await Job.findById(jobId).lean();
      if (!jobExists) {
        await deleteFromCloudinary(req.file.filename, true);
        return res.status(400).json({ message: 'Selected position does not exist.' });
      }
    }

    // Check for duplicate application (same email, same job)
    const existingApp = await Application.findOne({ email, jobId });
    if (existingApp) {
      await deleteFromCloudinary(req.file.filename, true);
      return res.status(400).json({ message: 'You have already applied for this position with this email.' });
    }

    // Cloudinary file URL
    const resumeUrl = req.file.path;

    const newApplication = new Application({
      jobId,
      fullName,
      email,
      phone,
      experienceYears,
      currentCTC,
      expectedCTC,
      noticePeriod,
      linkedinUrl,
      portfolioUrl,
      resumeUrl,
      coverLetter
    });

    const savedApplication = await newApplication.save();

    // Log for Email as per user's preference to keep it simple right now
    console.log("EMAIL TO HR:", {
      applicationId: savedApplication._id,
      jobId,
      fullName,
      email,
      phone,
      resumeLink: resumeUrl
    });



    res.status(201).json({ message: 'Application submitted successfully', application: savedApplication });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting application', error: error.message });
  }
};

// Get all applications (Admin)
exports.getApplications = async (req, res) => {
  try {
    // Populate job title for better admin view
    const applications = await Application.find()
      .populate('jobId', 'title department')
      .sort({ createdAt: -1 })
      .lean();
      
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
};
