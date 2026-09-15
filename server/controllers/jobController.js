const Job = require('../models/Job');
const mongoose = require('mongoose');

// Helper to query by id whether stored as ObjectId or String
const buildIdFilter = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return {
      $or: [
        { _id: new mongoose.Types.ObjectId(id) },
        { _id: id }
      ]
    };
  }
  return { _id: id };
};

// Get all jobs (admin can see all, public only sees published)
exports.getJobs = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching jobs', error: error.message });
  }
};

// Get single job
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findOne(buildIdFilter(req.params.id)).lean();
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching job', error: error.message });
  }
};

// Create a new job
exports.createJob = async (req, res) => {
  try {
    const newJob = new Job(req.body);
    const savedJob = await newJob.save();
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(400).json({ message: 'Error creating job', error: error.message });
  }
};

// Update a job
exports.updateJob = async (req, res) => {
  try {
    const updatedJob = await Job.findOneAndUpdate(
      buildIdFilter(req.params.id),
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedJob) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(400).json({ message: 'Error updating job', error: error.message });
  }
};

// Delete a job
exports.deleteJob = async (req, res) => {
  try {
    const deletedJob = await Job.findOneAndDelete(buildIdFilter(req.params.id));
    if (!deletedJob) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job', error: error.message });
  }
};

