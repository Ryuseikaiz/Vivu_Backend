const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');

const router = express.Router();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Get nearby places using Google Places API
router.post('/nearby', auth, async (req, res) => {
  try {
    const { location, category, keyword, radius = 10000 } = req.body; // Default 10km

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('GOOGLE_MAPS_API_KEY is not set. Falling back to mock data.');
      return res.json({ places: getMockPlaces(category) });
    }

    // Build API params
    const apiParams = {
      location: `${location.lat},${location.lng}`,
      radius: radius,
      key: GOOGLE_MAPS_API_KEY,
      language: 'vi'
    };

    // Use keyword search if provided (more specific), otherwise use type
    if (keyword) {
      apiParams.keyword = keyword;
      console.log(`🔍 Searching with keyword: "${keyword}", radius: ${radius}m`);
    } else {
      apiParams.type = category;
      console.log(`🔍 Searching with type: "${category}", radius: ${radius}m`);
    }

    // First request
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: apiParams
    });

    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      let allPlaces = response.data.results || [];
      let nextPageToken = response.data.next_page_token;
      
      // Fetch additional pages if available (Google Places API returns max 60 results total)
      while (nextPageToken && allPlaces.length < 60) {
        // Wait 2 seconds before next request (Google requirement)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const nextResponse = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
          params: {
            pagetoken: nextPageToken,
            key: GOOGLE_MAPS_API_KEY
          }
        });
        
        if (nextResponse.data.status === 'OK') {
          allPlaces = allPlaces.concat(nextResponse.data.results);
          nextPageToken = nextResponse.data.next_page_token;
          console.log(`📄 Fetched page, total: ${allPlaces.length} places`);
        } else {
          break;
        }
      }
      
      const places = allPlaces.map(place => ({
        ...place,
        source: 'Google'
      }));
      
      console.log(`✅ Found ${places.length} places total`);
      res.json({ places });
    } else {
      console.error('Google Places API Error:', response.data.status, response.data.error_message);
      res.status(500).json({ error: 'Failed to fetch nearby places from Google', details: response.data.status });
    }
  } catch (error) {
    console.error('Error fetching nearby places:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reverse-geocode', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'Tọa độ không hợp lệ' });
    }

    if (GOOGLE_MAPS_API_KEY) {
      try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            latlng: `${latitude},${longitude}`,
            key: GOOGLE_MAPS_API_KEY,
            language: 'vi'
          },
          timeout: 7000
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
          const bestMatch = response.data.results[0];
          const components = extractAddressComponents(bestMatch.address_components);

          // Kiểm tra nếu ở Việt Nam, chỉ trả về tên tỉnh/thành phố
          const isVietnam = components.country === 'Việt Nam' || components.country === 'Vietnam';
          let simplifiedAddress = bestMatch.formatted_address;

          if (isVietnam) {
            // Tìm tỉnh/thành phố từ address_components
            const province = bestMatch.address_components.find(comp =>
              comp.types.includes('administrative_area_level_1')
            );

            if (province) {
              simplifiedAddress = province.long_name;
            } else if (components.city) {
              simplifiedAddress = components.city;
            }
          }

          return res.json({
            address: simplifiedAddress,
            fullAddress: bestMatch.formatted_address,
            components: components,
            source: 'Google'
          });
        }

        console.warn('Google reverse geocode status:', response.data.status, response.data.error_message);
      } catch (googleError) {
        console.error('Google reverse geocode error:', googleError.message);
      }
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'jsonv2',
          'accept-language': 'vi'
        },
        headers: {
          'User-Agent': 'VivuTravelApp/1.0 (support@vivutravel.local)'
        },
        timeout: 7000
      });

      if (response.data) {
        const { display_name, address = {} } = response.data;
        const isVietnam = address.country === 'Việt Nam' || address.country === 'Vietnam';

        // Nếu ở Việt Nam, chỉ lấy tên tỉnh/thành phố
        let simplifiedAddress = display_name;
        if (isVietnam) {
          simplifiedAddress = address.state || address.city || address.province || display_name;
        }

        return res.json({
          address: simplifiedAddress,
          fullAddress: display_name,
          components: {
            city: address.city || address.town || address.village || address.state,
            district: address.district || address.county || address.state_district,
            country: address.country
          },
          source: 'OpenStreetMap'
        });
      }
    } catch (osmError) {
      console.error('OpenStreetMap reverse geocode error:', osmError.message);
    }

    return res.status(404).json({ error: 'Không tìm thấy địa chỉ phù hợp cho vị trí này.' });
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    res.status(500).json({ error: 'Không thể xác định địa chỉ từ vị trí hiện tại.' });
  }
});

router.post('/geocode', auth, async (req, res) => {
  try {
    const rawQuery = typeof req.body.query === 'string' ? req.body.query.trim() : '';
    const placeId = typeof req.body.placeId === 'string' ? req.body.placeId.trim() : '';
    const addressHint = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    const explicitLocation = req.body.location;

    if (!rawQuery && !placeId && !explicitLocation) {
      return res.status(400).json({ error: 'Vui lòng nhập địa điểm bạn muốn khám phá.' });
    }

    if (explicitLocation && Number.isFinite(explicitLocation.lat) && Number.isFinite(explicitLocation.lng)) {
      return res.json({
        location: {
          lat: Number(explicitLocation.lat),
          lng: Number(explicitLocation.lng)
        },
        address: addressHint || rawQuery,
        components: req.body.components || null,
        source: req.body.source || 'Manual'
      });
    }

    if (placeId && GOOGLE_MAPS_API_KEY) {
      try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
          params: {
            place_id: placeId,
            key: GOOGLE_MAPS_API_KEY,
            language: 'vi',
            fields: 'geometry/location,formatted_address,address_component'
          },
          timeout: 7000
        });

        if (response.data.status === 'OK' && response.data.result) {
          const { geometry, formatted_address: formattedAddress, address_components: addressComponents } = response.data.result;
          const lat = geometry?.location?.lat;
          const lng = geometry?.location?.lng;

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return res.json({
              location: { lat, lng },
              address: formattedAddress,
              components: extractAddressComponents(addressComponents),
              source: 'Google'
            });
          }
        }

        console.warn('Google place details status:', response.data.status, response.data.error_message);
      } catch (googleError) {
        console.error('Google place details error:', googleError.message);
      }
    }

    if (GOOGLE_MAPS_API_KEY && rawQuery) {
      try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: rawQuery,
            key: GOOGLE_MAPS_API_KEY,
            language: 'vi'
          },
          timeout: 7000
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
          const bestMatch = response.data.results[0];
          const { lat, lng } = bestMatch.geometry.location || {};

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return res.json({
              location: { lat, lng },
              address: bestMatch.formatted_address,
              components: extractAddressComponents(bestMatch.address_components),
              source: 'Google'
            });
          }
        }

        console.warn('Google geocode status:', response.data.status, response.data.error_message);
      } catch (googleError) {
        console.error('Google geocode error:', googleError.message);
      }
    }

    if (rawQuery) {
      try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: rawQuery,
            format: 'jsonv2',
            addressdetails: 1,
            limit: 1,
            countrycodes: req.body.country || 'vn',
            'accept-language': 'vi'
          },
          headers: {
            'User-Agent': 'VivuTravelApp/1.0 (support@vivutravel.local)'
          },
          timeout: 7000
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const bestMatch = response.data[0];
          const lat = Number(bestMatch.lat);
          const lng = Number(bestMatch.lon);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return res.json({
              location: { lat, lng },
              address: bestMatch.display_name,
              components: extractComponentsFromOsm(bestMatch.address),
              source: 'OpenStreetMap'
            });
          }
        }
      } catch (osmError) {
        console.error('OpenStreetMap geocode error:', osmError.message);
      }
    }

    return res.status(404).json({ error: 'Không tìm thấy địa điểm phù hợp. Hãy thử tên khác.' });
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Không thể xác định tọa độ cho địa điểm này.' });
  }
});

router.post('/autocomplete', auth, async (req, res) => {
  try {
    const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
    const limit = Math.min(Number(req.body.limit) || 6, 10);

    if (query.length < 2) {
      return res.json({ suggestions: [] });
    }

    if (GOOGLE_MAPS_API_KEY) {
      try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
          params: {
            input: query,
            key: GOOGLE_MAPS_API_KEY,
            language: 'vi',
            components: req.body.country ? `country:${req.body.country}` : 'country:vn',
            sessiontoken: req.body.sessionToken || undefined,
            types: 'geocode'
          },
          timeout: 7000
        });

        if (response.data.status === 'OK' && Array.isArray(response.data.predictions)) {
          const suggestions = response.data.predictions.slice(0, limit).map((prediction) => ({
            id: prediction.place_id,
            placeId: prediction.place_id,
            label: prediction.structured_formatting?.main_text || prediction.description,
            description: prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || '',
            source: 'Google'
          }));

          return res.json({ suggestions });
        }

        console.warn('Google autocomplete status:', response.data.status, response.data.error_message);
      } catch (googleError) {
        console.error('Google autocomplete error:', googleError.message);
      }
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'jsonv2',
          addressdetails: 1,
          limit,
          countrycodes: req.body.country || 'vn',
          'accept-language': 'vi'
        },
        headers: {
          'User-Agent': 'VivuTravelApp/1.0 (support@vivutravel.local)'
        },
        timeout: 7000
      });

      if (Array.isArray(response.data)) {
        const suggestions = response.data.map((item) => ({
          id: item.place_id?.toString() || item.osm_id?.toString(),
          label: item.display_name,
          description: item.display_name,
          location: {
            lat: Number(item.lat),
            lng: Number(item.lon)
          },
          components: extractComponentsFromOsm(item.address),
          source: 'OpenStreetMap'
        }));

        return res.json({ suggestions });
      }
    } catch (osmError) {
      console.error('OpenStreetMap autocomplete error:', osmError.message);
    }

    res.json({ suggestions: [] });
  } catch (error) {
    console.error('Autocomplete error:', error.message);
    res.status(500).json({ error: 'Không thể gợi ý địa điểm lúc này.' });
  }
});

// Fallback to OpenStreetMap when Google Places fails
async function useOpenStreetMapFallback(location, category, radius, res) {
  try {
    // Map category to OpenStreetMap amenity types
    const amenityMapping = {
      restaurant: 'restaurant',
      cafe: 'cafe',
      lodging: 'hotel',
      tourist_attraction: 'attraction'
    };

    const amenity = amenityMapping[category] || 'restaurant';
    
    // Use Overpass API to find nearby places
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="${amenity}"](around:${radius},${location.lat},${location.lng});
        way["amenity"="${amenity}"](around:${radius},${location.lat},${location.lng});
        relation["amenity"="${amenity}"](around:${radius},${location.lat},${location.lng});
      );
      out center meta;
    `;

    const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000
    });

    if (response.data && response.data.elements) {
      const places = response.data.elements
        .filter(element => element.tags && element.tags.name)
        .slice(0, 20)
        .map(element => {
          const lat = element.lat || (element.center && element.center.lat);
          const lon = element.lon || (element.center && element.center.lon);
          
          return {
            place_id: element.id.toString(),
            name: element.tags.name,
            vicinity: element.tags['addr:street'] || element.tags['addr:city'] || 'Địa chỉ không xác định',
            rating: Math.random() * 2 + 3,
            price_level: Math.floor(Math.random() * 4) + 1,
            types: [category],
            geometry: {
              location: { lat, lng: lon }
            },
            opening_hours: element.tags.opening_hours,
            phone: element.tags.phone,
            website: element.tags.website,
            source: 'OpenStreetMap'
          };
        });

      res.json({ places });
    } else {
      res.json({ places: getMockPlaces(category) });
    }
  } catch (osmError) {
    console.error('OpenStreetMap fallback failed:', osmError.message);
    res.json({ places: getMockPlaces(category) });
  }
}

// Get place details using Google Places API
router.get('/place/:placeId', auth, async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('GOOGLE_MAPS_API_KEY is not set. Falling back to mock data.');
      return res.json({ place: getMockPlaceDetails(placeId) });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        key: GOOGLE_MAPS_API_KEY,
        language: 'vi',
        fields: 'name,formatted_address,rating,opening_hours,website,formatted_phone_number'
      }
    });

    if (response.data.status === 'OK') {
      res.json({ place: { ...response.data.result, source: 'Google' } });
    } else {
      res.status(404).json({ error: 'Place not found', details: response.data.status });
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

// Get photo from Google Places API
router.get('/photo/:photoReference', (req, res) => {
  const { photoReference } = req.params;
  const maxWidth = req.query.maxwidth || 400;

  if (!GOOGLE_MAPS_API_KEY) {
    return res.redirect(`https://via.placeholder.com/${maxWidth}x300?text=No+API+Key`);
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`;
  res.redirect(url);
});

// Mock data for when API key is not available
function getMockPlaces(category) {
  const mockData = {
    restaurant: [
      {
        place_id: 'mock_restaurant_1',
        name: 'Nhà hàng Phố Cổ',
        vicinity: 'Hoàn Kiếm, Hà Nội',
        rating: 4.5,
        price_level: 2,
        types: ['restaurant', 'food'],
        geometry: {
          location: { lat: 21.0285, lng: 105.8542 }
        }
      },
      {
        place_id: 'mock_restaurant_2',
        name: 'Bún Chả Hương Liên',
        vicinity: 'Hai Bà Trưng, Hà Nội',
        rating: 4.3,
        price_level: 1,
        types: ['restaurant', 'food'],
        geometry: {
          location: { lat: 21.0245, lng: 105.8412 }
        }
      }
    ],
    cafe: [
      {
        place_id: 'mock_cafe_1',
        name: 'Cà phê Cộng',
        vicinity: 'Ba Đình, Hà Nội',
        rating: 4.4,
        price_level: 2,
        types: ['cafe', 'food'],
        geometry: {
          location: { lat: 21.0313, lng: 105.8516 }
        }
      },
      {
        place_id: 'mock_cafe_2',
        name: 'The Coffee House',
        vicinity: 'Đống Đa, Hà Nội',
        rating: 4.2,
        price_level: 2,
        types: ['cafe', 'food'],
        geometry: {
          location: { lat: 21.0278, lng: 105.8342 }
        }
      }
    ],
    lodging: [
      {
        place_id: 'mock_hotel_1',
        name: 'Khách sạn Metropole',
        vicinity: 'Hoàn Kiếm, Hà Nội',
        rating: 4.8,
        price_level: 4,
        types: ['lodging'],
        geometry: {
          location: { lat: 21.0285, lng: 105.8542 }
        }
      },
      {
        place_id: 'mock_hotel_2',
        name: 'Lotte Hotel Hanoi',
        vicinity: 'Ba Đình, Hà Nội',
        rating: 4.6,
        price_level: 4,
        types: ['lodging'],
        geometry: {
          location: { lat: 21.0313, lng: 105.8516 }
        }
      }
    ],
    tourist_attraction: [
      {
        place_id: 'mock_attraction_1',
        name: 'Hồ Hoàn Kiếm',
        vicinity: 'Hoàn Kiếm, Hà Nội',
        rating: 4.7,
        price_level: 0,
        types: ['tourist_attraction'],
        geometry: {
          location: { lat: 21.0285, lng: 105.8542 }
        }
      },
      {
        place_id: 'mock_attraction_2',
        name: 'Văn Miếu',
        vicinity: 'Đống Đa, Hà Nội',
        rating: 4.5,
        price_level: 1,
        types: ['tourist_attraction'],
        geometry: {
          location: { lat: 21.0278, lng: 105.8342 }
        }
      }
    ]
  };

  return mockData[category] || [];
}

function getMockPlaceDetails(placeId) {
  return {
    place_id: placeId,
    name: 'Mock Place',
    vicinity: 'Mock Address',
    rating: 4.0,
    price_level: 2,
    opening_hours: {
      open_now: true,
      weekday_text: [
        'Thứ 2: 08:00–22:00',
        'Thứ 3: 08:00–22:00',
        'Thứ 4: 08:00–22:00',
        'Thứ 5: 08:00–22:00',
        'Thứ 6: 08:00–22:00',
        'Thứ 7: 08:00–22:00',
        'Chủ nhật: 08:00–22:00'
      ]
    }
  };
}

function extractAddressComponents(components = []) {
  const result = {
    city: null,
    district: null,
    country: null
  };

  components.forEach((component) => {
    if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
      result.city = result.city || component.long_name;
    }
    if (component.types.includes('sublocality') || component.types.includes('administrative_area_level_3')) {
      result.district = result.district || component.long_name;
    }
    if (component.types.includes('country')) {
      result.country = component.long_name;
    }
  });

  return result;
}

function extractComponentsFromOsm(address = {}) {
  return {
    city: address.city || address.town || address.village || address.state,
    district: address.district || address.county || address.state_district,
    country: address.country
  };
}

// Get place reviews using Google Places API
router.get('/place/:placeId/reviews', auth, async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      return res.status(400).json({ error: 'Place ID required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('GOOGLE_MAPS_API_KEY is not set. Returning mock reviews.');
      return res.json({ 
        place: { 
          name: 'Sample Place',
          rating: 4.5,
          user_ratings_total: 120
        },
        reviews: getMockReviews() 
      });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,rating,user_ratings_total,reviews',
        key: GOOGLE_MAPS_API_KEY,
        language: 'vi'
      }
    });

    if (response.data.status === 'OK') {
      const place = response.data.result;
      
      // Log first review to see what Google returns
      if (place.reviews && place.reviews.length > 0) {
        console.log('📸 First review data from Google:', {
          author_name: place.reviews[0].author_name,
          has_profile_photo_url: !!place.reviews[0].profile_photo_url,
          profile_photo_url: place.reviews[0].profile_photo_url?.substring(0, 100)
        });
      }
      
      // Process reviews to ensure proper avatar URLs
      const enhancedReviews = (place.reviews || []).map(review => {
        // Google returns profile_photo_url - use it if available
        // Otherwise generate avatar from name
        if (!review.profile_photo_url) {
          const colors = ['667eea', 'f59e0b', 'ec4899', '10b981', '3b82f6', 'ef4444', '8b5cf6'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const encodedName = encodeURIComponent(review.author_name || 'User');
          review.profile_photo_url = `https://ui-avatars.com/api/?name=${encodedName}&background=${randomColor}&color=fff&size=128&bold=true`;
        }
        
        // Keep all original review data including author_url if available
        return {
          author_name: review.author_name,
          author_url: review.author_url, // Link to Google profile
          language: review.language,
          profile_photo_url: review.profile_photo_url,
          rating: review.rating,
          relative_time_description: review.relative_time_description,
          text: review.text,
          time: review.time,
          translated: review.translated
        };
      });
      
      console.log(`📝 Processed ${enhancedReviews.length} reviews with avatars`);
      
      res.json({ 
        place: {
          name: place.name,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total
        },
        reviews: enhancedReviews 
      });
    } else {
      console.error('Google Places Details API Error:', response.data.status);
      res.status(500).json({ 
        error: 'Failed to fetch place reviews', 
        details: response.data.status 
      });
    }
  } catch (error) {
    console.error('Error fetching place reviews:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mock reviews for testing
function getMockReviews() {
  return [
    {
      author_name: 'Nguyễn Văn A',
      rating: 5,
      text: 'Địa điểm tuyệt vời! Phong cảnh đẹp, không khí trong lành. Rất đáng để ghé thăm.',
      time: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
      profile_photo_url: 'https://ui-avatars.com/api/?name=Nguyen+Van+A&background=667eea&color=fff&size=128'
    },
    {
      author_name: 'Trần Thị B',
      rating: 4,
      text: 'Nơi này khá đẹp, tuy nhiên hơi đông người vào cuối tuần. Nên đi vào ngày thường.',
      time: Math.floor(Date.now() / 1000) - 86400 * 12, // 12 days ago
      profile_photo_url: 'https://ui-avatars.com/api/?name=Tran+Thi+B&background=f59e0b&color=fff&size=128'
    },
    {
      author_name: 'Lê Văn C',
      rating: 5,
      text: 'Tuyệt vời! Phục vụ tốt, giá cả hợp lý. Sẽ quay lại lần nữa.',
      time: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
      profile_photo_url: 'https://ui-avatars.com/api/?name=Le+Van+C&background=ec4899&color=fff&size=128'
    }
  ];
}

module.exports = router;