const PayOS = require('@payos/node');

class PaymentService {
  constructor() {
    this.payOS = new PayOS(
      process.env.PAYOS_CLIENT_ID,
      process.env.PAYOS_API_KEY,
      process.env.PAYOS_CHECKSUM_KEY
    );
    
    this.subscriptionPlans = {
      monthly: {
        name: 'Gói tháng',
        price: 25000, // 99,000 VND
        duration: 1, // months
        description: 'Truy cập không giới hạn trong 1 tháng'
      },
      yearly: {
        name: 'Gói năm',
        price: 250000, // 990,000 VND (save 2 months)
        duration: 12, // months
        description: 'Truy cập không giới hạn trong 1 năm (tiết kiệm 2 tháng)'
      }
    };
  }

  async createPaymentLink(userId, planType, userEmail) {
    try {
      const plan = this.subscriptionPlans[planType];
      if (!plan) {
        throw new Error('Invalid subscription plan');
      }

      const orderId = `SUB_${userId}_${Date.now()}`;
      
      const paymentData = {
        orderCode: parseInt(orderId.replace(/[^0-9]/g, '').slice(-9)), // PayOS requires numeric orderCode
        amount: plan.price,
        description: `${plan.name} - AI Travel Agent`,
        items: [
          {
            name: plan.name,
            quantity: 1,
            price: plan.price
          }
        ],
        returnUrl: `${process.env.CLIENT_URL}/payment/success`,
        cancelUrl: `${process.env.CLIENT_URL}/payment/cancel`,
        buyerName: userEmail,
        buyerEmail: userEmail
      };

      const paymentLinkResponse = await this.payOS.createPaymentLink(paymentData);
      
      return {
        orderId,
        paymentUrl: paymentLinkResponse.checkoutUrl,
        orderCode: paymentData.orderCode,
        amount: plan.price,
        planType,
        duration: plan.duration
      };
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw new Error('Failed to create payment link');
    }
  }

  async verifyPayment(orderCode) {
    try {
      const paymentInfo = await this.payOS.getPaymentLinkInformation(orderCode);
      return paymentInfo;
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw new Error('Failed to verify payment');
    }
  }

  async handleWebhook(webhookData) {
    try {
      // Verify webhook signature if needed
      const { orderCode, status, amount } = webhookData;
      
      if (status === 'PAID') {
        return {
          success: true,
          orderCode,
          amount,
          status
        };
      }
      
      return {
        success: false,
        orderCode,
        status
      };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new Error('Failed to handle webhook');
    }
  }

  getSubscriptionPlans() {
    return this.subscriptionPlans;
  }
}

module.exports = PaymentService;