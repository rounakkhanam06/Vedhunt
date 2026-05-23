const navbarService = require('../services/navbarService');
const { SuccessResponse, PaginatedResponse } = require('../utils/apiResponse');

exports.getNavbarLinksAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const { links, total } = await navbarService.getActiveLinks(page, limit, search);
    
    res.status(200).json(new PaginatedResponse(links, page, limit, total));
  } catch (error) {
    next(error);
  }
};

exports.getNavbarLinksPublic = async (req, res, next) => {
  try {
    const links = await navbarService.getAllActiveLinks();
    res.status(200).json(new SuccessResponse(links));
  } catch (error) {
    next(error);
  }
};

exports.renameNavbarLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({ success: false, message: 'Label is required' });
    }

    const updatedLink = await navbarService.renameLink(id, label, req.user._id);
    res.status(200).json(new SuccessResponse(updatedLink, 'Navbar link renamed successfully'));
  } catch (error) {
    next(error);
  }
};

exports.deleteNavbarLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    await navbarService.softDeleteLink(id, req.user._id);
    res.status(200).json(new SuccessResponse(null, 'Navbar link deleted successfully'));
  } catch (error) {
    next(error);
  }
};
