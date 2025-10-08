const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy - DISABLED (using google-auth-library in auth controller instead)
// Uncomment and add GOOGLE_CLIENT_SECRET to .env if you want to use Passport Google OAuth
/*
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // User exists, return user
            return done(null, user);
          }

          // Check if email already exists
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.avatar = user.avatar || profile.photos[0]?.value;
            await user.save();
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            avatar: profile.photos[0]?.value,
            authProvider: 'google',
            emailVerified: true // Google emails are verified
          });

          await newUser.save();
          done(null, newUser);

        } catch (error) {
          console.error('Google OAuth error:', error);
          done(error, null);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy initialized');
} else {
  console.log('⚠️  Google OAuth not configured');
}
*/
console.log('ℹ️  Using google-auth-library for Google Sign-In (no client secret needed)');

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'photos', 'email'],
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ facebookId: profile.id });

          if (user) {
            // User exists, return user
            return done(null, user);
          }

          // Check if email already exists
          if (profile.emails && profile.emails[0]) {
            user = await User.findOne({ email: profile.emails[0].value });

            if (user) {
              // Link Facebook account to existing user
              user.facebookId = profile.id;
              user.avatar = user.avatar || profile.photos[0]?.value;
              await user.save();
              return done(null, user);
            }
          }

          // Create new user
          const newUser = new User({
            facebookId: profile.id,
            email: profile.emails?.[0]?.value || `facebook_${profile.id}@vivu.local`,
            name: profile.displayName,
            avatar: profile.photos[0]?.value,
            authProvider: 'facebook',
            emailVerified: !!profile.emails?.[0]?.value
          });

          await newUser.save();
          done(null, newUser);

        } catch (error) {
          console.error('Facebook OAuth error:', error);
          done(error, null);
        }
      }
    )
  );
  console.log('✅ Facebook OAuth strategy initialized');
} else {
  console.log('⚠️  Facebook OAuth not configured');
}

module.exports = passport;
