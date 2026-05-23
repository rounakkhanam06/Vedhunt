const heroService = require('../services/heroService');
const { SuccessResponse, ErrorResponse } = require('../utils/apiResponse');

exports.getHero = async (req, res, next) => {
  try {
    const hero = await heroService.getActiveHero();
    res.status(200).json(new SuccessResponse(hero));
  } catch (error) {
    next(error);
  }
};

exports.updateHero = async (req, res, next) => {
  try {
    const hero = await heroService.updateHero(req.body, req.user._id);
    res.status(200).json(new SuccessResponse(hero, 'Hero section updated successfully'));
  } catch (error) {
    next(error);
  }
};
