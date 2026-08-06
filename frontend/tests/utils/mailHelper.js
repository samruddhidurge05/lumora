export async function getEmailAddress() {
  const domRes = await fetch('https://api.mail.tm/domains');
  const doms = await domRes.json();
  const domain = doms['hydra:member'][0].domain;
  
  const address = 'qa_' + Date.now() + '@' + domain;
  const password = 'TestPassword123!';
  
  // Create account
  await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  
  // Get token
  const tokRes = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });
  const { token } = await tokRes.json();
  
  return { email_addr: address, token, password };
}

export async function waitForVerificationEmail(sessionData, timeoutMs = 60000) {
  const startTime = Date.now();
  const { token } = sessionData;
  
  while (Date.now() - startTime < timeoutMs) {
    const res = await fetch('https://api.mail.tm/messages', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data['hydra:member'] && data['hydra:member'].length > 0) {
      for (const mail of data['hydra:member']) {
        if (mail.subject.includes('Verify') || mail.from.address.includes('firebase')) {
          // Fetch full email
          const fullRes = await fetch(`https://api.mail.tm/messages/${mail.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const fullData = await fullRes.json();
          
          // Parse verification link (works for text or html body)
          const body = fullData.text || fullData.html;
          const match = body.match(/https?:\/\/[^\s"'<]+mode=verifyEmail[^\s"'<]+/);
          if (match) {
            return match[0];
          }
        }
      }
    }
    
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Verification email not received within timeout.');
}
