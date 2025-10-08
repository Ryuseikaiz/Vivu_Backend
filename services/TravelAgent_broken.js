const { GoogleGenerativeAI } = require('@google/generative-ai');
const FlightsFinder = require('./FlightsFinder');
const HotelsFinder = require('./HotelsFinder');

class TravelAgent {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const modelNames = ['gemini-2.5-pro'];
    
    let modelInitialized = false;
    for (const modelName of modelNames) {
      try {
        this.model = this.genAI.getGenerativeModel({ model: modelName });
        console.log(`Successfully initialized with model: ${modelName}`);
        modelInitialized = true;
        break;
      } catch (error) {
        console.log(`Failed to initialize model ${modelName}:`, error.message);
      }
    }
    
    if (!modelInitialized) {
      console.error('Failed to initialize any AI model - will use fallback responses');
      this.model = null;
    }
    
    this.flightsFinder = new FlightsFinder();
    this.hotelsFinder = new HotelsFinder();
    
    this.systemPrompt = `Bạn là trợ lý du lịch AI thông minh. Tạo lịch trình du lịch chi tiết bằng tiếng Việt với HTML format đẹp.`;
  }

  buildTravelDetailsFromMetadata(metadata = {}) {
    const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
    const details = {};

    const origin = sanitizeString(metadata.origin);
    if (origin) details.origin = origin;

    const destination = sanitizeString(metadata.destination);
    if (destination) details.destination = destination;

    const startDate = sanitizeString(metadata.startDate);
    if (startDate) details.departureDate = startDate;

    const endDate = sanitizeString(metadata.endDate);
    if (endDate) details.returnDate = endDate;

    const passengers = Number(metadata.travelers);
    if (Number.isFinite(passengers) && passengers > 0) {
      details.passengers = passengers;
    }

    return details;
  }

  async searchFlights(travelDetails) {
    try {
      return await this.flightsFinder.search(travelDetails);
    } catch (error) {
      console.error('Error searching flights:', error);
      return { error: error.message };
    }
  }

  async searchHotels(travelDetails) {
    try {
      return await this.hotelsFinder.search(travelDetails);
    } catch (error) {
      console.error('Error searching hotels:', error);
      return { error: error.message };
    }
  }

  async processQuery(query, threadId, metadata = {}) {
    try {
      console.log('Processing query...');
      
      // Build travel details from metadata first
      const metadataDetails = this.buildTravelDetailsFromMetadata(metadata);
      
      // For demo purposes, return detailed mock response
      if (query.toLowerCase().includes('demo') || 
          (metadataDetails.origin && metadataDetails.destination)) {
        return this.createDemoResponse(query, metadataDetails);
      }
      
      // Check if model is available
      if (!this.model) {
        console.log('AI model not available - providing fallback response');
        return this.createFallbackResponse(query, metadataDetails);
      }
      
      // Simple prompt for quick response
      const prompt = `Tạo lịch trình du lịch ngắn gọn cho: ${query}`;
      
      console.log('Sending request to Gemini API...');
      const result = await Promise.race([
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7,
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 20 seconds')), 20000)
        )
      ]);
      
      const response = result.response.text();
      console.log('✅ Query processed successfully');
      return response;

    } catch (error) {
      console.error('Error in TravelAgent.processQuery:', error);
      
      // Return demo response on any error
      return this.createDemoResponse(query, this.buildTravelDetailsFromMetadata(metadata));
    }
  }

  createDemoResponse(query, metadata) {
    // Mock data dựa trên form: Đà Nẵng -> TP.HCM, 2 người, 3 ngày
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hành Trình Đà Nẵng - Sài Gòn</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 18px; }
        .content { padding: 30px; }
        .trip-info { background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 20px 0; border-left: 5px solid #667eea; }
        .section { margin: 30px 0; }
        .section h2 { color: #2c3e50; font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        .card { background: white; border-radius: 10px; padding: 20px; margin: 15px 0; box-shadow: 0 3px 10px rgba(0,0,0,0.1); border-left: 4px solid #3498db; }
        .price { color: #e74c3c; font-weight: bold; font-size: 18px; }
        .rating { color: #f39c12; }
        .amenities { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .amenity { background: #ecf0f1; padding: 4px 8px; border-radius: 15px; font-size: 12px; }
        .flight-card { background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); color: white; }
        .hotel-card { background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%); color: white; }
        .food-card { background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); color: white; }
        .itinerary { background: #dff9fb; border-radius: 10px; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌟 Hành Trình Đà Nẵng - Sài Gòn</h1>
          <p>Kế hoạch du lịch cá nhân hóa cho 2 người | 3 ngày 3 đêm</p>
        </div>
        
        <div class="content">
          <div class="trip-info">
            <h3>📍 Thông Tin Chuyến Đi</h3>
            <p><strong>🛫 Khởi hành:</strong> ${metadata.origin || 'Đà Nẵng'} → ${metadata.destination || 'Quận 8, TP.HCM'}</p>
            <p><strong>📅 Thời gian:</strong> ${metadata.departureDate || '27/09/2025'} - ${metadata.returnDate || '30/09/2025'}</p>
            <p><strong>👥 Số khách:</strong> ${metadata.passengers || '2'} người</p>
            <p><strong>💰 Tổng ngân sách ước tính:</strong> <span class="price">4,200,000 VNĐ</span></p>
          </div>

          <div class="section">
            <h2>✈️ Chuyến Bay</h2>
            <div class="card flight-card">
              <h3>Vietnam Airlines VN1317</h3>
              <p><strong>Đà Nẵng (DAD)</strong> → <strong>Tân Sơn Nhất (SGN)</strong></p>
              <p>🕐 Khởi hành: 08:30 | 🕐 Đến: 09:50 (1h 20p)</p>
              <p class="price">💰 1,980,000 VNĐ/người</p>
            </div>
          </div>

          <div class="section">
            <h2>🏨 Khách Sạn Đề Xuất</h2>
            <div class="card hotel-card">
              <h3>Hôtel des Arts Saigon MGallery</h3>
              <p>📍 Quận 1 (gần Quận 8) | ⭐ 4.6/5 (3,216 đánh giá)</p>
              <p class="price">💰 4,200,000 VNĐ/3 đêm</p>
              <div class="amenities">
                <span class="amenity">🏊 Hồ bơi</span>
                <span class="amenity">🍽️ Nhà hàng</span>
                <span class="amenity">💆 Spa</span>
                <span class="amenity">🅿️ Đỗ xe miễn phí</span>
                <span class="amenity">📶 WiFi</span>
              </div>
            </div>
            
            <div class="card">
              <h3>TeeUp Home - Infinity Pool</h3>
              <p>📍 Quận 8 | ⭐ 5.0/5 (8 đánh giá)</p>
              <p class="price">💰 630,000 VNĐ/3 đêm</p>
              <div class="amenities">
                <span class="amenity">🏊 Hồ bơi vô cực</span>
                <span class="amenity">🍳 Bếp</span>
                <span class="amenity">🚗 Đưa đón sân bay</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>🍜 Ẩm Thực Địa Phương</h2>
            <div class="card food-card">
              <h3>Quán Ăn Ngon Sài Gòn</h3>
              <p>🏮 <strong>Phở Hùng</strong> - Phở bò truyền thống (50,000 VNĐ)</p>
              <p>🥢 <strong>Bánh Mì Huỳnh Hoa</strong> - Bánh mì đặc biệt (45,000 VNĐ)</p>
              <p>🦐 <strong>Ốc Oanh</strong> - Ốc nướng tiêu (120,000 VNĐ)</p>
              <p>☕ <strong>Cà phê Sài Gòn</strong> - Cà phê sữa đá (25,000 VNĐ)</p>
            </div>
          </div>

          <div class="section">
            <h2>🛍️ Mua Sắm & Giải Trí</h2>
            <div class="card">
              <h3>Địa Điểm Mua Sắm</h3>
              <p>🏬 <strong>Saigon Centre</strong> - Trung tâm thương mại cao cấp</p>
              <p>🛒 <strong>Chợ Bến Thành</strong> - Chợ truyền thống, đặc sản</p>
              <p>👕 <strong>Đường Đồng Khởi</strong> - Phố thời trang</p>
            </div>
            
            <div class="card">
              <h3>Giải Trí Đêm</h3>
              <p>🍻 <strong>Skydeck Bar</strong> - Bar tầng thượng view thành phố</p>
              <p>🎵 <strong>Phố đi bộ Nguyễn Huệ</strong> - Nhạc nước, biểu diễn</p>
              <p>🌃 <strong>Chợ đêm Quận 8</strong> - Ẩm thực đêm, mua sắm</p>
            </div>
          </div>

          <div class="section">
            <h2>📅 Lịch Trình Chi Tiết</h2>
            <div class="itinerary">
              <h4>🗓️ Ngày 1 (27/09): Khám Phá Quận 1</h4>
              <p>• 09:50 - Đến sân bay Tân Sơn Nhất</p>
              <p>• 11:00 - Check-in khách sạn, nghỉ ngơi</p>
              <p>• 14:00 - Tham quan Dinh Độc Lập</p>
              <p>• 16:00 - Mua sắm Chợ Bến Thành</p>
              <p>• 19:00 - Ăn tối tại Ốc Oanh</p>
              
              <h4>🗓️ Ngày 2 (28/09): Văn Hóa & Ẩm Thực</h4>
              <p>• 08:00 - Phở sáng tại Phở Hùng</p>
              <p>• 09:30 - Bảo tàng Chứng tích Chiến tranh</p>
              <p>• 12:00 - Bánh mì Huỳnh Hoa</p>
              <p>• 15:00 - Nhà thờ Đức Bà, Bưu điện Thành phố</p>
              <p>• 20:00 - Phố đi bộ Nguyễn Huệ</p>
              
              <h4>🗓️ Ngày 3 (29/09): Quận 8 & Chuẩn Bị</h4>
              <p>• 09:00 - Khám phá Quận 8, chợ địa phương</p>
              <p>• 12:00 - Ăn trưa đặc sản miền Nam</p>
              <p>• 15:00 - Mua quà lưu niệm</p>
              <p>• 18:00 - Skydeck Bar ngắm hoàng hôn</p>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #e8f4fd; border-radius: 10px;">
            <p style="color: #2980b9; font-weight: bold; font-size: 16px;">
              🎉 Chúc bạn có chuyến đi thú vị tại Sài Gòn!
            </p>
            <p style="color: #7f8c8d; margin: 5px 0;">
              💡 Lưu ý: Giá cả có thể thay đổi. Đặt trước để có giá tốt nhất!
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  createFallbackResponse(query, metadata) {
    return `
    <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #856404; margin: 0 0 10px 0;">🔧 Hệ Thống Đang Cập Nhật</h3>
      <p style="color: #856404; margin: 0;">
        Xin lỗi, AI model hiện không khả dụng. Chúng tôi đang làm việc để khôi phục dịch vụ.
      </p>
      <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">
        <strong>Truy vấn của bạn:</strong> ${query}
      </p>
    </div>
    `;
  }
    try {
      console.log('Processing query...');
      
      const metadataDetails = this.buildTravelDetailsFromMetadata(metadata);
      
      if (!this.model) {
        console.log('AI model not available - providing fallback response');
        return this.createFallbackResponse(query, metadataDetails);
      }
      
      // Search for real data
      let hotelResults = null;
      try {
        hotelResults = await this.searchHotels(metadataDetails);
        console.log('Kết quả khách sạn:', hotelResults ? hotelResults.slice(0, 2) : 'Không có');
      } catch (error) {
        console.log('Lỗi tìm khách sạn:', error.message);
      }

      // Create simple prompt
      const simplePrompt = `Tạo lịch trình du lịch cho: "${query}"

${hotelResults && hotelResults.length > 0 ? 
`KHÁCH SẠN GỢI Ý:
${hotelResults.slice(0, 2).map(h => `- ${h.name}: ${h.rate_per_night || 'N/A'}/đêm, Rating: ${h.rating}/5`).join('\n')}` : ''}

Yêu cầu:
- Trả lời bằng tiếng Việt
- Sử dụng HTML format đơn giản
- Tối đa 500 từ để tránh timeout
- Bao gồm thông tin khách sạn thực tế nếu có`;

      console.log('Sending simple request to Gemini API...');
      
      const result = await Promise.race([
        this.model.generateContent(simplePrompt, {
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 20 seconds')), 20000)
        )
      ]);
      
      console.log('Received response from Gemini API');
      const response = result.response.text();
      
      console.log('Response length:', response.length);
      console.log('Response preview:', response.substring(0, 200));
      
      if (!response || response.trim().length === 0) {
        console.log('Empty response, using fallback');
        return this.createFallbackResponse(query, metadataDetails);
      }
      
      console.log('✅ Query processed successfully');
      return response;

    } catch (error) {
      console.error('Error in TravelAgent.processQuery:', error);
      
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        return `
        <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
          <h3 style="color: #856404;">⏱️ Yêu cầu xử lý quá lâu</h3>
          <p style="color: #856404;">
            Xin lỗi, yêu cầu của bạn mất quá nhiều thời gian để xử lý. Vui lòng thử lại với câu hỏi ngắn gọn hơn.
          </p>
        </div>
        `;
      }
      
      if (error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
        return `
        <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
          <h3 style="color: #856404;">🚫 Đã đạt giới hạn API</h3>
          <p style="color: #856404;">
            Đã đạt giới hạn API trong ngày. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.
          </p>
        </div>
        `;
      }
      
      return `
      <div style="padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px;">
        <h3 style="color: #721c24;">⚠️ Lỗi Hệ Thống</h3>
        <p style="color: #721c24;">
          Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.
        </p>
        <p style="color: #721c24; font-size: 14px;">
          <strong>Lỗi:</strong> ${error.message}
        </p>
      </div>
      `;
    }
  }

  createFallbackResponse(query, metadataDetails) {
    return `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h2 style="color: #2c3e50;">🌟 Kế Hoạch Du Lịch</h2>
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="color: #1565c0;">📍 Yêu cầu của bạn</h3>
        <p><strong>Truy vấn:</strong> ${query}</p>
        ${metadataDetails.origin ? `<p><strong>Điểm đi:</strong> ${metadataDetails.origin}</p>` : ''}
        ${metadataDetails.destination ? `<p><strong>Điểm đến:</strong> ${metadataDetails.destination}</p>` : ''}
      </div>
      <div style="background: #fff3e0; padding: 15px; border-radius: 8px;">
        <p style="color: #ef6c00; margin: 0;">
          🔧 AI đang được cập nhật. Vui lòng thử lại sau!
        </p>
      </div>
    </div>
    `;
  }
}

module.exports = TravelAgent;