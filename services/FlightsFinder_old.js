const axios = require('axios');

class FlightsFinder {
  constructor() {
    this.serpApiKey = process.env.SERPAPI_API_KEY;
  }

  async search(travelDetails) {
    // Always try to use real API first
    try {
      if (this.serpApiKey) {
        return await this.searchWithSerpAPI(travelDetails);
      } else {
        return await this.searchWithAviationAPI(travelDetails);
      }
    } catch (error) {
      console.error('Error searching flights with real APIs:', error);
      throw new Error('Unable to search flights at the moment. Please try again later.');
    }
  }

  async searchWithSerpAPI(travelDetails) {
    const params = {
      engine: 'google_flights',
      api_key: this.serpApiKey,
      departure_id: this.getAirportCode(travelDetails.origin) || 'HAN',
      arrival_id: this.getAirportCode(travelDetails.destination) || 'NRT',
      outbound_date: travelDetails.departureDate || new Date().toISOString().split('T')[0],
      return_date: travelDetails.returnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'USD',
      hl: 'en',
      adults: travelDetails.passengers || 1
    };

    const response = await axios.get('https://serpapi.com/search', { 
      params,
      timeout: 15000 // 15 second timeout for flights
    });
    
    if (response.data.best_flights && response.data.best_flights.length > 0) {
      return this.formatFlightResults(response.data.best_flights);
    } else if (response.data.other_flights && response.data.other_flights.length > 0) {
      return this.formatFlightResults(response.data.other_flights);
    } else {
      throw new Error('No flights found for the specified route and dates');
    }
  }

  async searchWithAviationAPI(travelDetails) {
    // Alternative: Use Amadeus API, Skyscanner API, or other flight APIs
    const origin = travelDetails.origin || 'Hanoi';
    const destination = travelDetails.destination || 'Tokyo';
    
    // For now, throw error to indicate no API key available
    throw new Error(`No flight API key configured. Please add SERPAPI_API_KEY to search flights from ${origin} to ${destination}`);
  }

  getAirportCode(cityOrCode) {
    const airportCodes = {
      'hanoi': 'HAN',
      'ho chi minh': 'SGN',
      'saigon': 'SGN',
      'tokyo': 'NRT',
      'osaka': 'KIX',
      'bangkok': 'BKK',
      'singapore': 'SIN',
      'kuala lumpur': 'KUL',
      'manila': 'MNL',
      'jakarta': 'CGK'
    };
    
    // If it's already an airport code (3 letters), return as is
    if (cityOrCode && cityOrCode.length === 3 && cityOrCode.match(/^[A-Z]{3}$/)) {
      return cityOrCode;
    }
    
    // Otherwise, try to find the airport code for the city
    const city = cityOrCode ? cityOrCode.toLowerCase() : '';
    return airportCodes[city] || cityOrCode;
  }

  formatFlightResults(flights) {
    return flights.slice(0, 3).map(flight => ({
      airline: flight.flights[0].airline,
      departure_airport: flight.flights[0].departure_airport.name,
      arrival_airport: flight.flights[0].arrival_airport.name,
      departure_time: flight.flights[0].departure_time,
      arrival_time: flight.flights[0].arrival_time,
      duration: flight.total_duration,
      price: flight.price,
      currency: 'USD',
      airline_logo: flight.flights[0].airline_logo,
      booking_link: flight.booking_token ? `https://www.google.com/flights/booking?token=${flight.booking_token}` : 'https://www.google.com/flights'
    }));
  }
}

module.exports = FlightsFinder;
}

module.exports = FlightsFinder;