const axios = require('axios');

class HotelsFinder {
  constructor() {
    this.serpApiKey = process.env.SERPAPI_API_KEY;
  }

  async search(travelDetails) {
    if (!this.serpApiKey) {
      return this.getMockHotelData();
    }

    try {
      const params = {
        engine: 'google_hotels',
        api_key: this.serpApiKey,
        q: `hotels in ${travelDetails.destination || 'Tokyo'}`,
        check_in_date: travelDetails.departureDate || '2024-12-01',
        check_out_date: travelDetails.returnDate || '2024-12-07',
        currency: 'USD',
        hl: 'en'
      };

      const response = await axios.get('https://serpapi.com/search', { params });
      
      if (response.data.properties) {
        return this.formatHotelResults(response.data.properties);
      }
      
      return this.getMockHotelData();
    } catch (error) {
      console.error('Error calling SerpAPI for hotels:', error);
      return this.getMockHotelData();
    }
  }

  formatHotelResults(hotels) {
    return hotels.slice(0, 3).map(hotel => ({
      name: hotel.name,
      description: hotel.description,
      location: hotel.location,
      rate_per_night: hotel.rate_per_night?.lowest,
      total_rate: hotel.total_rate?.lowest,
      currency: 'USD',
      rating: hotel.overall_rating,
      reviews: hotel.reviews,
      amenities: hotel.amenities,
      images: hotel.images,
      link: hotel.link
    }));
  }

  getMockHotelData() {
    return [
      {
        name: 'Tokyo Grand Hotel',
        description: 'Luxury hotel in the heart of Tokyo with modern amenities and excellent service.',
        location: 'Shibuya, Tokyo',
        rate_per_night: 280,
        total_rate: 1680,
        currency: 'USD',
        rating: 4.5,
        reviews: 1250,
        amenities: ['Free Wi-Fi', 'Restaurant', 'Fitness Center', 'Spa', 'Business Center'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300'],
        link: 'https://www.booking.com'
      },
      {
        name: 'Sakura Business Hotel',
        description: 'Modern business hotel with comfortable rooms and convenient location.',
        location: 'Shinjuku, Tokyo',
        rate_per_night: 180,
        total_rate: 1080,
        currency: 'USD',
        rating: 4.2,
        reviews: 890,
        amenities: ['Free Wi-Fi', 'Restaurant', 'Business Center', 'Laundry'],
        images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=300'],
        link: 'https://www.booking.com'
      },
      {
        name: 'Imperial Palace Hotel',
        description: 'Traditional Japanese hotel with beautiful gardens and authentic experience.',
        location: 'Chiyoda, Tokyo',
        rate_per_night: 450,
        total_rate: 2700,
        currency: 'USD',
        rating: 4.8,
        reviews: 2100,
        amenities: ['Free Wi-Fi', 'Traditional Restaurant', 'Spa', 'Garden', 'Concierge'],
        images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=300'],
        link: 'https://www.booking.com'
      }
    ];
  }
}

module.exports = HotelsFinder;