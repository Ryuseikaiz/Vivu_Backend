const { GoogleGenerativeAI } = require('@google/generative-ai');
const FlightsFinder = require('./FlightsFinder');
const HotelsFinder = require('./HotelsFinder');

class TravelAgent {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Try multiple model names in order of preference (newest and best first)
    const modelNames = [
      'gemini-2.5-pro',          // Newest and most capable
    ];
    
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
    
    this.systemPrompt = `You are a smart travel agency AI assistant. Your task is to help users find travel information including flights, hotels, and local restaurants/eateries.

INSTRUCTIONS:
- You are allowed to make multiple searches (either together or in sequence)
- If the user asks for suggestions nearby, you can ask for their current location to provide better recommendations.
- Based on the user's current location or their travel destination, suggest popular restaurants and eateries.
- Only look up information when you are sure of what you want
- The current year is ${new Date().getFullYear()}
- Always include links to hotels websites, flights websites, and restaurant websites/menus when possible.
- Include logos of hotels, airline companies, and photos of restaurants/food when available.
- Always include prices in the local currency and USD when possible
- Format your response in clean HTML for better presentation

PRICING FORMAT EXAMPLE:
For hotels: Rate: $581 per night, Total: $3,488
For flights: Price: $850 USD
For restaurants: Price range: $10 - $50

RESPONSE FORMAT:
- Use proper HTML structure with headings, lists, and styling
- Include images for airline logos, hotel photos, and restaurant/food photos
- Provide clickable links for booking or viewing menus
- Show clear pricing information
- Use Vietnamese language for user-facing content

Remember to be helpful, accurate, and provide comprehensive travel and dining information.`;
  }

  buildTravelDetailsFromMetadata(metadata = {}) {
    const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
    const details = {};

    const origin = sanitizeString(metadata.origin);
    if (origin) {
      details.origin = origin;
    }

    const destination = sanitizeString(metadata.destination);
    if (destination) {
      details.destination = destination;
    }

    const startDate = sanitizeString(metadata.startDate);
    if (startDate) {
      details.departureDate = startDate;
    }

    const endDate = sanitizeString(metadata.endDate);
    if (endDate) {
      details.returnDate = endDate;
    }

    const passengers = Number(metadata.travelers);
    if (Number.isFinite(passengers) && passengers > 0) {
      details.passengers = passengers;
    }

    // Add budget information
    const budget = sanitizeString(metadata.budget);
    if (budget) {
      details.budget = budget;
    }

    // Add travel style
    const travelStyle = sanitizeString(metadata.travelStyle);
    if (travelStyle) {
      details.travelStyle = travelStyle;
    }

    return details;
  }

  mergeTravelDetails(analysisDetails = {}, metadataDetails = {}, query) {
    return {
      ...metadataDetails,
      ...analysisDetails,
      rawQuery: query
    };
  }

  async processQuery(query, threadId, metadata = {}) {
    try {
      console.log('Processing query...');
      
      // Build travel details from metadata first
      const metadataDetails = this.buildTravelDetailsFromMetadata(metadata);
      
      // Check if model is available
      if (!this.model) {
        console.log('AI model not available - providing fallback response');
        return this.createFallbackResponse(query, metadataDetails);
      }
      
      console.log('Creating optimized travel research prompt...');
      
      // Prepare destination and origin info
      const destination = metadataDetails.destination || 'điểm đến trong câu hỏi';
      const origin = metadataDetails.origin || 'điểm xuất phát trong câu hỏi';
      const dates = metadataDetails.departureDate ? `từ ${metadataDetails.departureDate}${metadataDetails.returnDate ? ` đến ${metadataDetails.returnDate}` : ''}` : '';
      const travelers = metadataDetails.passengers ? `${metadataDetails.passengers} người` : '';
      const budget = metadataDetails.budget || 'Linh hoạt';
      const travelStyle = metadataDetails.travelStyle || 'Cân bằng';

      const comprehensivePrompt = `Bạn là chuyên gia tư vấn du lịch AI chuyên nghiệp. Nhiệm vụ của bạn là cung cấp kế hoạch du lịch thực tế, chi tiết và hữu ích.

📋 THÔNG TIN CHUYẾN ĐI:
- Điểm đi: ${origin}
- Điểm đến: ${destination}
- Thời gian: ${dates || 'Chưa xác định'}
- Số khách: ${travelers || 'Chưa xác định'}
- Ngân sách: ${budget}
- Phong cách: ${travelStyle}
- Yêu cầu: "${query}"

🎯 HÃY TẠO KẾ HOẠCH DU LỊCH BAO GỒM:

1️⃣ THÔNG TIN CHUYẾN BAY:
   - Các hãng hàng không phổ biến (Vietnam Airlines, VietJet, Bamboo...)
   - Giá vé ước tính (khứ hồi cho ${travelers || '1 người'})
   - Thời gian bay và số chuyến/ngày
   - Gợi ý: đặt vé sớm, giờ bay tốt nhất

2️⃣ LƯU TRÚ KHÁCH SẠN:
   - Top 3-4 khách sạn được đánh giá cao (3-5 sao)
   - Giá phòng/đêm cho mỗi khách sạn
   - Vị trí và tiện nghi nổi bật
   - Khu vực nên ở (gần trung tâm, bãi biển...)
   - **QUAN TRỌNG**: Thêm link Google Maps cho mỗi khách sạn

3️⃣ ẨM THỰC ĐỊA PHƯƠNG:
   - Món ăn đặc sản phải thử (5-7 món)
   - Nhà hàng/quán ăn nổi tiếng cụ thể với tên và địa chỉ
   - Giá trung bình mỗi bữa
   - Địa chỉ và giờ mở cửa
   - **QUAN TRỌNG**: Thêm link Google Maps hoặc website cho mỗi nhà hàng/quán ăn

4️⃣ ĐỊA ĐIỂM THAM QUAN:
   - Top 5-7 điểm du lịch must-visit
   - Giá vé tham quan (nếu có)
   - Thời gian nên đến và thời gian tham quan
   - Gợi ý lịch trình theo ngày
   - **QUAN TRỌNG**: Thêm link Google Maps cho mỗi địa điểm

5️⃣ THUÊ XE & DI CHUYỂN:
   - Các công ty cho thuê xe uy tín (Grab, xe máy, ô tô tự lái...)
   - Giá thuê xe theo ngày/tuần
   - Phương tiện công cộng (bus, tàu, xe buýt...)
   - Chi phí di chuyển ước tính
   - Gợi ý phương tiện phù hợp với ${travelStyle}
   - **QUAN TRỌNG**: Thêm link đến website hoặc ứng dụng đặt xe

6️⃣ TOUR & HOẠT ĐỘNG:
   - Top 3-5 tour du lịch nổi tiếng
   - Hoạt động thể thao phiêu lưu (lặn biển, leo núi, zipline...)
   - Tour văn hóa/lịch sử
   - Giá tour và thời gian
   - Công ty tổ chức tour uy tín
   - **QUAN TRỌNG**: Thêm link website tour hoặc đặt vé

7️⃣ CHI PHÍ ƯỚC TÍNH (theo ngân sách ${budget}):
   - Vé máy bay: X - Y triệu VNĐ
   - Khách sạn: X - Y triệu VNĐ/đêm
   - Ăn uống: X - Y triệu VNĐ/ngày
   - Tham quan: X - Y triệu VNĐ
   - Thuê xe/di chuyển: X - Y triệu VNĐ
   - Tour & hoạt động: X - Y triệu VNĐ
   - TỔNG ƯỚC TÍNH: X - Y triệu VNĐ

8️⃣ LƯU Ý QUAN TRỌNG:
   - Thời tiết tại ${destination}
   - Giấy tờ cần thiết (visa, passport...)
   - Phương tiện di chuyển tại địa phương
   - Mẹo tiết kiệm chi phí

📐 YÊU CẦU FORMAT HTML:
- Sử dụng HTML với CSS inline đẹp mắt
- Màu sắc: gradient từ #667eea đến #764ba2 cho header
- Icons emoji phù hợp (✈️ 🏨 🍜 📍 💰)
- Bố cục rõ ràng, dễ đọ với sections riêng biệt
- Responsive và professional
- Highlight giá cả và thông tin quan trọng

🔗 HYPERLINKS BẮT BUỘC - MỌI TÊN ĐỀU PHẢI CÓ LINK:
- Tên khách sạn → Link dạng: <a href="https://www.google.com/maps/search/[TÊN+KHÁCH+SẠN]+${destination}" target="_blank" style="color: #2196f3; text-decoration: none; font-weight: bold;">[Tên Khách Sạn]</a>
- Tên nhà hàng/quán ăn → Link dạng: <a href="https://www.google.com/maps/search/[TÊN+NHÀ+HÀNG]+${destination}" target="_blank" style="color: #2196f3; text-decoration: none;">[Tên Nhà Hàng]</a>
- Địa điểm tham quan → Link dạng: <a href="https://www.google.com/maps/search/[TÊN+ĐỊA+ĐIỂM]+${destination}" target="_blank" style="color: #2196f3; text-decoration: none;">[Tên Địa Điểm]</a>
- Thêm icon � hoặc � ngay trước link
- Links phải mở trong tab mới (target="_blank")
- Style links: màu xanh #2196f3, bold cho tên địa điểm

📝 VÍ DỤ CÁCH FORMAT:
Khách sạn: 📍 <a href="https://www.google.com/maps/search/Liberty+Central+Saigon+Citypoint+${destination.replace(/ /g, '+')}" target="_blank" style="color: #2196f3; text-decoration: none; font-weight: bold;">Liberty Central Saigon Citypoint</a>

Nhà hàng: 📍 <a href="https://www.google.com/maps/search/Phở+2000+${destination.replace(/ /g, '+')}" target="_blank" style="color: #2196f3; text-decoration: none;">Phở 2000</a> - Quán phở nổi tiếng

Địa điểm: 📍 <a href="https://www.google.com/maps/search/Dinh+Độc+Lập+${destination.replace(/ /g, '+')}" target="_blank" style="color: #2196f3; text-decoration: none;">Dinh Độc Lập</a>

⚠️ LƯU Ý: PHẢI thêm link cho TẤT CẢ tên khách sạn, nhà hàng, quán ăn, và địa điểm tham quan!

Hãy đưa ra kế hoạch CỤ THỂ, THỰC TẾ với giá cả, địa chỉ CHÍNH XÁC và LINKS đầy đủ dựa trên kiến thức của bạn về ${destination}.`;

      console.log('Sending comprehensive travel research request to Gemini API...');
      console.log('Prompt length:', comprehensivePrompt.length, 'characters');
      
      // Increase timeout and add generation config for detailed response
      const researchResult = await Promise.race([
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: comprehensivePrompt }] }],
          generationConfig: {
            temperature: 0.8, // More creative for travel suggestions
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192, // Increase to allow more detailed response (was 4096)
          },
        }).catch(err => {
          console.error('❌ Gemini API Error:', err.message);
          console.error('Error details:', JSON.stringify(err, null, 2));
          throw err;
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Research timeout after 120 seconds')), 120000) // Increase to 120s
        )
      ]);
      
      console.log('✅ Received response from Gemini API');
      
      // Get the response text
      const response = await researchResult.response;
      console.log('Response object received, extracting text...');
      
      const finalResponse = response.text();
      console.log('Text extracted successfully');
      
      // Clean and validate the response
      const cleanedResponse = finalResponse.trim();
      console.log('📊 Response length:', cleanedResponse.length, 'characters');
      console.log('📝 Response preview (first 300 chars):', cleanedResponse.substring(0, 300));
      console.log('📝 Response ending (last 200 chars):', cleanedResponse.substring(cleanedResponse.length - 200));
      
      if (!cleanedResponse || cleanedResponse.length === 0) {
        console.log('⚠️ Empty response from Gemini, using fallback');
        return this.createFallbackResponse(query, metadataDetails);
      }
      
      // Start with cleaned response
      let formattedResponse = cleanedResponse;
      
      // Auto-fix incomplete HTML - count and close unclosed tags
      const openTags = (formattedResponse.match(/<(div|p|h[1-6]|ul|ol|li|section|article|span|strong|em)[^>]*>/gi) || []);
      const closeTags = (formattedResponse.match(/<\/(div|p|h[1-6]|ul|ol|li|section|article|span|strong|em)>/gi) || []);
      
      console.log('🏷️ Open tags count:', openTags.length);
      console.log('🏷️ Close tags count:', closeTags.length);
      
      if (openTags.length > closeTags.length) {
        console.log('⚠️ Detected unclosed HTML tags, attempting to fix...');
        
        // Simple fix: close all major container tags
        const unclosedDivs = (formattedResponse.match(/<div[^>]*>/gi) || []).length - 
                            (formattedResponse.match(/<\/div>/gi) || []).length;
        const unclosedPs = (formattedResponse.match(/<p[^>]*>/gi) || []).length - 
                          (formattedResponse.match(/<\/p>/gi) || []).length;
        
        console.log(`📝 Adding ${unclosedDivs} </div> and ${unclosedPs} </p> tags`);
        
        // Close paragraph tags first, then div tags
        for (let i = 0; i < unclosedPs; i++) {
          formattedResponse += '</p>';
        }
        for (let i = 0; i < unclosedDivs; i++) {
          formattedResponse += '</div>';
        }
        
        // Add completion notice
        formattedResponse += `
        <div style="padding: 15px; margin: 20px 0; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
          <p style="margin: 0; color: #1565c0; font-size: 14px;">
            <strong>ℹ️ Thông báo:</strong> Kế hoạch du lịch đã được tạo hoàn chỉnh với ${cleanedResponse.length} ký tự. 
            Nếu cần thêm chi tiết, hãy yêu cầu cụ thể hơn!
          </p>
        </div>
        `;
      }
      
      // Ensure the response is properly formatted HTML
      if (!cleanedResponse.includes('<html') && !cleanedResponse.includes('<div') && !cleanedResponse.includes('```')) {
        // Wrap plain text in HTML div
        formattedResponse = `
        <div style="padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto;">
          ${cleanedResponse.replace(/\n/g, '<br>')}
        </div>
        `;
      }
      
      // Remove markdown code blocks if present
      formattedResponse = formattedResponse
        .replace(/```html\n?/g, '')
        .replace(/```\n?$/g, '')
        .trim();
      
      console.log('✅ Query processed successfully with real Gemini research');
      console.log('📤 Returning response of', formattedResponse.length, 'characters');
      return formattedResponse;

    } catch (error) {
      console.error('Error in TravelAgent.processQuery:', error);
      
      // Check different types of errors and provide appropriate responses
      if (error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
        return `
        <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #856404; margin: 0 0 10px 0;">🚫 Đã Đạt Giới Hạn API</h3>
          <p style="color: #856404; margin: 0;">
            Xin lỗi, chúng tôi đã đạt giới hạn API hôm nay. Vui lòng thử lại sau hoặc liên hệ với chúng tôi để được hỗ trợ.
          </p>
          <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">
            Sorry, we've reached our API limit for today. Please try again later.
          </p>
        </div>
        `;
      }
      
      if (error.message?.includes('Service Unavailable') || error.status === 503) {
        return `
        <div style="padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #721c24; margin: 0 0 10px 0;">🔧 Dịch Vụ Tạm Thời Không Khả Dụng</h3>
          <p style="color: #721c24; margin: 0;">
            Dịch vụ AI hiện đang quá tải hoặc bảo trì. Vui lòng thử lại sau vài phút.
          </p>
          <p style="color: #721c24; margin: 10px 0 0 0; font-size: 14px;">
            The AI service is currently overloaded or under maintenance. Please try again in a few minutes.
          </p>
          <div style="margin: 15px 0; padding: 10px; background-color: rgba(114, 28, 36, 0.1); border-radius: 4px;">
            <p style="color: #721c24; margin: 0; font-size: 12px;">
              <strong>Mẹo:</strong> Hãy thử lại sau 2-3 phút hoặc đặt câu hỏi ngắn gọn hơn.
            </p>
          </div>
        </div>
        `;
      }
      
      if (error.message?.includes('timeout')) {
        return `
        <div style="padding: 20px; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0c5460; margin: 0 0 10px 0;">⏱️ Yêu Cầu Quá Lâu</h3>
          <p style="color: #0c5460; margin: 0;">
            Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử lại với câu hỏi ngắn gọn hơn.
          </p>
          <p style="color: #0c5460; margin: 10px 0 0 0; font-size: 14px;">
            Request took too long to process. Please try again with a shorter question.
          </p>
        </div>
        `;
      }
      
      // Generic error fallback
      return `
      <div style="padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #721c24; margin: 0 0 10px 0;">⚠️ Lỗi Hệ Thống</h3>
        <p style="color: #721c24; margin: 0;">
          Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.
        </p>
        <p style="color: #721c24; margin: 10px 0 0 0; font-size: 14px;">
          Sorry, an error occurred while processing your request. Please try again later.
        </p>
        <p style="color: #721c24; margin: 10px 0 0 0; font-size: 14px;">
          <strong>Lỗi:</strong> ${error.message}
        </p>
      </div>
      `;
    }
  }

  createFallbackResponse(query, metadataDetails) {
    return `
    <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px;">
      <h2 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
        🌟 Kết Quả Tìm Kiếm Du Lịch
      </h2>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; font-size: 18px;">📍 Thông Tin Chuyến Đi</h3>
        <div style="display: grid; gap: 10px;">
          <p style="margin: 5px 0;"><strong>🔍 Truy vấn:</strong> ${query}</p>
          ${metadataDetails.origin ? `<p style="margin: 5px 0;"><strong>🛫 Điểm đi:</strong> ${metadataDetails.origin}</p>` : ''}
          ${metadataDetails.destination ? `<p style="margin: 5px 0;"><strong>🛬 Điểm đến:</strong> ${metadataDetails.destination}</p>` : ''}
          ${metadataDetails.departureDate ? `<p style="margin: 5px 0;"><strong>📅 Ngày đi:</strong> ${metadataDetails.departureDate}</p>` : ''}
          ${metadataDetails.returnDate ? `<p style="margin: 5px 0;"><strong>🔄 Ngày về:</strong> ${metadataDetails.returnDate}</p>` : ''}
          ${metadataDetails.passengers ? `<p style="margin: 5px 0;"><strong>👥 Số hành khách:</strong> ${metadataDetails.passengers}</p>` : ''}
          ${metadataDetails.budget ? `<p style="margin: 5px 0;"><strong>💰 Ngân sách:</strong> ${metadataDetails.budget}</p>` : ''}
          ${metadataDetails.travelStyle ? `<p style="margin: 5px 0;"><strong>🎨 Phong cách:</strong> ${metadataDetails.travelStyle}</p>` : ''}
        </div>
      </div>
      
      <div style="background: #fff3e0; padding: 20px; border-radius: 12px; border-left: 4px solid #ff9800; margin: 20px 0;">
        <h3 style="color: #f57c00; margin: 0 0 15px 0;">⚠️ Thông Báo</h3>
        <p style="color: #f57c00; margin: 0;">
          Dịch vụ AI hiện tại đang bảo trì. Chúng tôi sẽ sớm cung cấp thông tin chi tiết về chuyến đi của bạn.
        </p>
        <p style="color: #f57c00; margin: 10px 0 0 0; font-style: italic;">
          Vui lòng thử lại sau vài phút hoặc liên hệ hỗ trợ khách hàng.
        </p>
      </div>
      
      <div style="text-align: center; margin: 20px 0; color: #666; font-size: 14px;">
        <p>⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
      </div>
    </div>
    `;
  }

  async searchFlights(travelDetails) {
    try {
      return await this.flightsFinder.search(travelDetails);
    } catch (error) {
      console.error('Error searching flights:', error);
      return { error: 'Failed to search flights' };
    }
  }

  async searchHotels(travelDetails) {
    try {
      return await this.hotelsFinder.search(travelDetails);
    } catch (error) {
      console.error('Error searching hotels:', error);
      return { error: 'Failed to search hotels' };
    }
  }
}

module.exports = TravelAgent;