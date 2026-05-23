const NavbarLink = require('../models/NavbarLink');

class NavbarService {
  // Fetch active links with pagination and search
  async getActiveLinks(page = 1, limit = 10, search = '') {
    const query = { isDeleted: false };
    
    if (search) {
      query.label = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [links, total] = await Promise.all([
      NavbarLink.find(query)
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .select('-__v -isDeleted')
        .lean(),
      NavbarLink.countDocuments(query)
    ]);

    return { links, total };
  }
  
  // Get all for frontend (no pagination)
  async getAllActiveLinks() {
    return await NavbarLink.find({ isDeleted: false })
      .sort({ order: 1 })
      .select('label path order')
      .lean();
  }

  // Rename a link
  async renameLink(id, newLabel, userId) {
    const link = await NavbarLink.findById(id);
    if (!link || link.isDeleted) {
      throw new Error('Link not found');
    }

    link.label = newLabel;
    link.updatedBy = userId;
    await link.save();

    return link;
  }

  // Soft delete a link
  async softDeleteLink(id, userId) {
    const link = await NavbarLink.findById(id);
    if (!link || link.isDeleted) {
      throw new Error('Link not found');
    }

    link.isDeleted = true;
    link.updatedBy = userId;
    await link.save();

    return true;
  }
}

module.exports = new NavbarService();
