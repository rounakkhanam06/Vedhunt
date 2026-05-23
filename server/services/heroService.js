const Hero = require('../models/Hero');

class HeroService {
  // Fetch hero with lean() for fast reading
  async getActiveHero() {
    return await Hero.findOne({ isActive: true })
      .select('-__v -createdAt -updatedAt')
      .lean();
  }

  // Update hero using upsert pattern
  async updateHero(data, userId) {
    let hero = await Hero.findOne({ isActive: true });

    if (hero) {
      Object.assign(hero, data);
      hero.updatedBy = userId;
      await hero.save();
    } else {
      hero = new Hero({
        ...data,
        updatedBy: userId,
        isActive: true
      });
      await hero.save();
    }

    return hero;
  }
}

module.exports = new HeroService();
