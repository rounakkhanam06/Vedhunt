const AboutHero = require('../models/AboutHero');

const getAboutHero = async (req, res) => {
  try {
    let hero = await AboutHero.findOne();
    if (!hero) {
      hero = await AboutHero.create({});
    }
    res.json(hero);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching About Hero data', error: error.message });
  }
};

const updateAboutHero = async (req, res) => {
  try {
    let hero = await AboutHero.findOne();
    if (!hero) {
      hero = new AboutHero(req.body);
      await hero.save();
    } else {
      hero = await AboutHero.findOneAndUpdate({}, req.body, { new: true, runValidators: true });
    }
    res.json({ message: 'About Hero updated successfully', data: hero });
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating About Hero data', error: error.message });
  }
};

module.exports = {
  getAboutHero,
  updateAboutHero
};
