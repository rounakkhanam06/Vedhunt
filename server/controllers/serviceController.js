const serviceManager = require('../services/serviceManager');
const { SuccessResponse, PaginatedResponse } = require('../utils/apiResponse');

exports.getServicesPublic = async (req, res, next) => {
  try {
    const { location } = req.query;
    const services = await serviceManager.getPublicServices(location);
    res.status(200).json(new SuccessResponse(services));
  } catch (error) {
    next(error);
  }
};

exports.getServicesAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const { services, total } = await serviceManager.getAdminServices(Number(page), Number(limit), search);
    
    res.status(200).json(new PaginatedResponse(services, page, limit, total));
  } catch (error) {
    next(error);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const service = await serviceManager.createService(req.body, req.user._id);
    res.status(201).json(new SuccessResponse(service, 'Service created successfully'));
  } catch (error) {
    next(error);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await serviceManager.updateService(id, req.body, req.user._id);
    res.status(200).json(new SuccessResponse(service, 'Service updated successfully'));
  } catch (error) {
    next(error);
  }
};

exports.deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    await serviceManager.softDeleteService(id, req.user._id);
    res.status(200).json(new SuccessResponse(null, 'Service deleted successfully'));
  } catch (error) {
    next(error);
  }
};
