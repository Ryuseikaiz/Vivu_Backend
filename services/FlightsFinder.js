const axios = require('axios');

class FlightsFinder {
  constructor() {
    this.serpApiKey = process.env.SERPAPI_API_KEY;
  }

  async search(travelDetails) {
    if (!this.serpApiKey) {
      return this.getMockFlightData();
    }

    try {
      const params = {
        engine: 'google_flights',
        api_key: this.serpApiKey,
        departure_id: travelDetails.origin || 'HAN', // Default to Hanoi
        arrival_id: travelDetails.destination || 'NRT', // Default to Tokyo
        outbound_date: travelDetails.departureDate || '2024-12-01',
        return_date: travelDetails.returnDate || '2024-12-07',
        currency: 'USD',
        hl: 'en'
      };

      const response = await axios.get('https://serpapi.com/search', { params });
      
      if (response.data.best_flights) {
        return this.formatFlightResults(response.data.best_flights);
      }
      
      return this.getMockFlightData();
    } catch (error) {
      console.error('Error calling SerpAPI for flights:', error);
      return this.getMockFlightData();
    }
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
      booking_link: 'https://www.google.com/flights'
    }));
  }

  getMockFlightData() {
    return [
      {
        airline: 'Vietnam Airlines',
        departure_airport: 'Noi Bai International Airport (HAN)',
        arrival_airport: 'Narita International Airport (NRT)',
        departure_time: '10:25 AM',
        arrival_time: '5:25 PM',
        duration: '6 hours',
        price: 850,
        currency: 'USD',
        airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/VN.png',
        booking_link: 'https://www.google.com/flights'
      },
      {
        airline: 'Japan Airlines',
        departure_airport: 'Noi Bai International Airport (HAN)',
        arrival_airport: 'Narita International Airport (NRT)',
        departure_time: '2:15 PM',
        arrival_time: '9:15 PM',
        duration: '6 hours',
        price: 920,
        currency: 'USD',
        airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/JL.png',
        booking_link: 'https://www.google.com/flights'
      },
      {
        airline: 'ANA',
        departure_airport: 'Noi Bai International Airport (HAN)',
        arrival_airport: 'Narita International Airport (NRT)',
        departure_time: '11:30 AM',
        arrival_time: '6:30 PM',
        duration: '6 hours',
        price: 890,
        currency: 'USD',
        airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/NH.png',
        booking_link: 'https://www.google.com/flights'
      }
    ];
  }
}

module.exports = FlightsFinder;