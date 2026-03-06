const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gvhjibzjrcrkjgnezuok.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aGppYnpqcmNya2pnbmV6dW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzM2NTYsImV4cCI6MjA4NzE0OTY1Nn0.OimvDFps4Op6cdoNYoEhOpvBH9K23MFpuale-pCR8Ag';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdminUser() {
  try {
    console.log('Creating admin user...');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'kizitodonpedro@gmail.com',
      password: '123456',
      options: {
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('User already exists in auth. Checking profile...');

        const { data: existingUser } = await supabase.auth.signInWithPassword({
          email: 'kizitodonpedro@gmail.com',
          password: '123456',
        });

        if (existingUser?.user) {
          const { data: profile, error: profileFetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', existingUser.user.id)
            .maybeSingle();

          if (profileFetchError) {
            console.error('Error fetching profile:', profileFetchError.message);
            return;
          }

          if (profile) {
            console.log('✓ User already exists with profile!');
            console.log('Email: kizitodonpedro@gmail.com');
            console.log('Password: 123456');
            console.log('Role:', profile.role);
            console.log('Full Name:', profile.full_name);
          } else {
            console.log('User exists but no profile. Creating profile...');
            const { error: profileError } = await supabase.from('profiles').insert({
              id: existingUser.user.id,
              full_name: 'Admin User',
              role: 'admin',
            });

            if (profileError) {
              console.error('Error creating profile:', profileError.message);
              return;
            }

            console.log('✓ Admin profile created successfully!');
            console.log('Email: kizitodonpedro@gmail.com');
            console.log('Password: 123456');
            console.log('Role: admin');
          }
        }
        return;
      }
      console.error('Error creating auth user:', authError.message);
      return;
    }

    console.log('Auth user created:', authData.user?.id);

    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: 'Admin User',
        role: 'admin',
      });

      if (profileError) {
        console.error('Error creating profile:', profileError.message);
        return;
      }

      console.log('✓ Admin user created successfully!');
      console.log('Email: kizitodonpedro@gmail.com');
      console.log('Password: 123456');
      console.log('Role: admin');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser();
