const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt for Vivu Travel assistant
const SYSTEM_PROMPT = `Bạn là trợ lý AI của Vivu Travel - nền tảng lập kế hoạch du lịch thông minh tại Việt Nam (https://www.vivuvivu.site).

🎯 NHIỆM VỤ:
- Tư vấn về địa điểm du lịch, khách sạn, nhà hàng, quán ăn, café tại Việt Nam
- Giúp người dùng lập kế hoạch chuyến đi, tính toán chi phí, gợi ý lịch trình
- Tìm kiếm địa điểm gần vị trí hiện tại của người dùng (nếu được cấp quyền)
- Giải đáp thắc mắc về cách sử dụng Vivu
- Hỗ trợ kỹ thuật cơ bản

✨ CÁC TÍNH NĂNG CHÍNH CỦA VIVU:
🤖 **AI Lập Kế Hoạch Du Lịch**: Tạo lịch trình chi tiết, tìm chuyến bay và khách sạn tự động
🗺️ **Bản Đồ Tương Tác**: Chọn địa điểm du lịch trên bản đồ với routing (chỉ đường)
📍 **Tìm Địa Điểm Gần Đây**: Quán ăn, khách sạn, điểm tham quan xung quanh vị trí của bạn
📧 **Gửi Lịch Trình qua Email**: Lưu và chia sẻ kế hoạch du lịch
📱 **Xem Bài Viết Facebook**: Cập nhật tin tức và khuyến mãi từ fanpage Vivu
� **Đăng Nhập Google OAuth**: Đăng ký/đăng nhập nhanh chóng

💎 GÓI PREMIUM:
- **Dùng thử miễn phí**: 1 ngày Premium cho người dùng mới (khi vừa tạo tài khoản)
- **Gói tháng**: 25,000 VNĐ/tháng - Sử dụng không giới hạn AI lập kế hoạch
- **Gói năm**: 250,000 VNĐ/năm - Tiết kiệm 2 tháng (chỉ 20,833 VNĐ/tháng)
- **Mã khuyến mãi demo**: Nhập **VIVU1MON** để nhận 1 tháng Premium miễn phí
- **Khuyến mãi đặc biệt**: Theo dõi fanpage Facebook (https://www.facebook.com/vivuvivuv1) để nhận mã giảm giá 1 tuần/1 tháng Premium

📞 LIÊN HỆ HỖ TRỢ:
- Facebook Messenger: https://m.me/vivuvivuv1
- Fanpage: https://www.facebook.com/vivuvivuv1
- Website: https://www.vivuvivu.site

🎨 PHONG CÁCH GIAO TIẾP:
- Thân thiện, nhiệt tình, chuyên nghiệp
- Trả lời ngắn gọn, rõ ràng (2-4 câu)
- Sử dụng emoji phù hợp: ✈️🏖️🌴🎒🗺️📍🍜💎🎉
- Nếu không biết, hướng dẫn liên hệ Facebook Messenger

🔍 TÌM KIẾM ĐỊA ĐIỂM GẦN ĐÂY:
Khi người dùng hỏi về địa điểm gần đây:
- Kiểm tra xem có thông tin vị trí trong LOCATION_CONTEXT không
- Nếu có vị trí: thông báo "Tôi đang tìm [loại món ăn/địa điểm] gần bạn... 🔍" và sử dụng [SEARCH_NEARBY:category|keyword]
  
📋 CATEGORIES HỖ TRỢ:
  + restaurant - Nhà hàng nói chung
  + cafe - Quán cà phê
  + hotel / lodging - Khách sạn
  + tourist_attraction - Điểm tham quan
  + bar - Quán bar
  + night_club - Hộp đêm
  + shopping_mall - Trung tâm thương mại
  
🍕 TÌM KIẾM THEO KEYWORD (ƯU TIÊN):
Nếu người dùng hỏi món ăn CỤ THỂ, dùng format: [SEARCH_NEARBY:restaurant|keyword]
  + Ví dụ: 
    - "quán pizza" → [SEARCH_NEARBY:restaurant|pizza]
    - "quán phở" → [SEARCH_NEARBY:restaurant|pho]
    - "quán bbq" → [SEARCH_NEARBY:restaurant|bbq]
    - "quán sushi" → [SEARCH_NEARBY:restaurant|sushi]
    - "quán lẩu" → [SEARCH_NEARBY:restaurant|hotpot]
    - "quán cơm" → [SEARCH_NEARBY:restaurant|com]
    - "nhà hàng hải sản" → [SEARCH_NEARBY:restaurant|seafood]
    - "quán ăn vặt" → [SEARCH_NEARBY:restaurant|street food]
  
- Nếu không có vị trí: yêu cầu người dùng cấp quyền truy cập vị trí trên trình duyệt

⚠️ LƯU Ý QUAN TRỌNG:
- Chỉ trả lời về du lịch Việt Nam và tính năng thực tế của Vivu
- KHÔNG đề cập các tính năng KHÔNG TỒN TẠI: gamification, tích điểm, huy hiệu, chia sẻ thẻ du lịch, lưu lịch trình vào calendar, blog cá nhân
- Từ chối câu hỏi không liên quan đến du lịch
- Luôn khuyến khích người dùng đăng ký Premium để trải nghiệm đầy đủ
- Nhắc mã VIVU1MON khi người dùng hỏi về giá hoặc khuyến mãi`;

// POST /api/chat/gemini - Chat with Gemini AI
router.post('/gemini', async (req, res) => {
  try {
    const { message, context, userLocation } = req.body;

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required',
        reply: 'Xin lỗi, tôi không nhận được tin nhắn của bạn. Vui lòng thử lại! 😊'
      });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({
        error: 'AI service not configured',
        reply: 'Xin lỗi, dịch vụ AI tạm thời không khả dụng. Vui lòng chat qua Facebook Messenger để được hỗ trợ ngay! 💬'
      });
    }

    // Get Gemini model (gemini-2.5-pro - same as TravelAgent)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    });

    // Build location context if available
    let locationContext = '';
    if (userLocation && userLocation.lat && userLocation.lng) {
      locationContext = `\n\nLOCATION_CONTEXT: Người dùng hiện đang ở vị trí (${userLocation.lat}, ${userLocation.lng}). Bạn có thể sử dụng [SEARCH_NEARBY:category|keyword] để tìm địa điểm gần đây.`;
    }

    // Build conversation context
    const prompt = `${SYSTEM_PROMPT}${locationContext}

Người dùng hỏi: ${message}

Trả lời (ngắn gọn, thân thiện):`;

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let reply = response.text();

    // Check if AI wants to search nearby - support both formats: [SEARCH_NEARBY:category] and [SEARCH_NEARBY:category|keyword]
    const nearbyMatch = reply.match(/\[SEARCH_NEARBY:([^\]]+)\]/);
    if (nearbyMatch && userLocation) {
      const searchParam = nearbyMatch[1];
      const [category, keyword] = searchParam.includes('|') ? searchParam.split('|') : [searchParam, null];
      
      try {
        // Get user's token from request headers
        const token = req.headers.authorization;
        
        // Prepare search payload
        const searchPayload = {
          location: userLocation,
          category: category,
          radius: 10000 // Increase radius to 10km for wider coverage
        };
        
        // Add keyword if specified
        if (keyword) {
          searchPayload.keyword = keyword.trim();
        }
        
        console.log(`🔍 Searching nearby: category="${category}", keyword="${keyword || 'none'}", radius=10km`);
        
        // Call nearby API
        const nearbyResponse = await axios.post(
          `${process.env.API_URL || 'http://localhost:5000'}/api/location/nearby`,
          searchPayload,
          {
            headers: token ? { Authorization: token } : {}
          }
        );

        const places = nearbyResponse.data.places || [];
        
        // Determine what to call the search results
        let searchLabel = keyword ? keyword : category;
        if (searchLabel === 'restaurant') searchLabel = 'nhà hàng';
        else if (searchLabel === 'cafe') searchLabel = 'quán café';
        else if (searchLabel === 'hotel' || searchLabel === 'lodging') searchLabel = 'khách sạn';
        else if (searchLabel === 'tourist_attraction') searchLabel = 'điểm tham quan';
        
        // Format places with Google Maps links - NO LIMIT on number of places
        const placesInfo = places.map((p, i) => {
          // Create Google Maps search link
          const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + (p.vicinity || ''))}`;
          return `${i + 1}. <a href="${mapLink}" target="_blank" style="color: #2196f3; text-decoration: none; font-weight: bold;">📍 ${p.name}</a> - ${p.vicinity || 'Không có địa chỉ'} ${p.rating ? `(⭐ ${p.rating})` : ''}`;
        }).join('\n');

        // Remove the search command and add results
        reply = reply.replace(/\[SEARCH_NEARBY:[^\]]+\]/, '').trim();
        
        if (places.length > 0) {
          const emoji = keyword === 'pizza' ? '🍕' : keyword === 'pho' ? '🍜' : keyword === 'sushi' ? '🍱' : keyword === 'bbq' ? '🍖' : '📍';
          reply += `\n\n${emoji} Tôi tìm thấy ${places.length} ${searchLabel} trong bán kính 10km:\n\n${placesInfo}\n\n💡 Click vào tên địa điểm để xem trên Google Maps!`;
        } else {
          reply += `\n\nXin lỗi, tôi không tìm thấy ${searchLabel} phù hợp gần bạn trong bán kính 10km. Bạn có thể thử tìm loại địa điểm khác! 🔍`;
        }

        // Return with places data for frontend to display on map
        return res.json({
          reply: reply.trim(),
          timestamp: new Date().toISOString(),
          nearbyPlaces: places.slice(0, 10)
        });

      } catch (nearbyError) {
        console.error('Error fetching nearby places:', nearbyError);
        reply = reply.replace(/\[SEARCH_NEARBY:\w+\]/, '').trim();
        reply += '\n\nXin lỗi, có lỗi khi tìm kiếm địa điểm. Vui lòng thử lại! 🙏';
      }
    }

    // Log for monitoring
    console.log(`[Gemini Chat] User: ${message.substring(0, 50)}...`);
    console.log(`[Gemini Chat] AI: ${reply.substring(0, 50)}...`);

    res.json({
      reply: reply.trim(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API error:', error);

    // Handle rate limit errors
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        reply: 'Xin lỗi, hiện tại có quá nhiều người dùng. Vui lòng thử lại sau vài phút hoặc chat qua Facebook Messenger! 🙏'
      });
    }

    // Handle other errors
    res.status(500).json({
      error: 'AI service error',
      reply: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại hoặc chat qua Facebook Messenger để được hỗ trợ trực tiếp! 💬'
    });
  }
});

module.exports = router;
