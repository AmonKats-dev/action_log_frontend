import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { ROLES } from '../constants/roles';
import { api } from '../services/api';

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const LoginContainer = styled.div`
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #f4e4c1 0%, #e8d5a3 50%, #d2b173 100%);
  min-height: 100vh;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: auto;
  padding: 12px 0;
  box-sizing: border-box;
  @media (max-width: 600px) {
    padding: 8px 0;
    align-items: flex-start;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="80" r="1" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>') repeat;
    opacity: 0.3;
  }
`;

const LoginCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  position: relative;
  z-index: 1;
  animation: ${slideUp} 0.8s ease-out;
  display: flex;
  @media (max-width: 900px) {
    flex-direction: column;
    max-height: none;
    min-height: auto;
    border-radius: 16px;
    margin: 16px;
  }
  @media (max-width: 600px) {
    margin: 12px;
    max-height: 95vh;
    overflow-y: auto;
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  @media (max-width: 900px) {
    max-height: 35vh;
    overflow-y: auto;
    padding: 12px;
  }
  @media (max-width: 600px) {
    max-height: 30vh;
    padding: 10px;
  }
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  @media (max-width: 900px) {
    min-height: 0;
  }
`;



const TestCredentialsTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
  text-align: center;
  color: white;
`;

const TestCredentialsSubtitle = styled.p`
  font-size: 12px;
  opacity: 0.9;
  text-align: center;
  margin-bottom: 12px;
  line-height: 1.3;
`;

const TestCredentialsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 12px;
`;

const TestCredentialButton = styled.button<{ isSelected: boolean }>`
  padding: 8px 10px;
  font-size: 12px;
  background: ${props => props.isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  color: white;
  border: 2px solid ${props => props.isSelected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)'};
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CredentialUsername = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
`;

const CredentialPhone = styled.div`
  font-size: 11px;
  opacity: 0.9;
  margin-bottom: 1px;
`;

const CredentialRole = styled.div`
  font-size: 10px;
  opacity: 0.8;
  font-style: italic;
`;

const DevelopmentNote = styled.div`
  text-align: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 11px;
  opacity: 0.9;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  padding: 40px 30px 30px;
  text-align: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -50px;
    left: -50px;
    width: 100px;
    height: 100px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    animation: ${float} 6s ease-in-out infinite;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -30px;
    right: -30px;
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
    animation: ${float} 4s ease-in-out infinite reverse;
  }
`;

const Logo = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 15px;
  }
`;

const SystemTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  position: relative;
  z-index: 2;
  @media (max-width: 600px) {
    font-size: 18px;
    margin-bottom: 6px;
  }
`;

const DepartmentInfo = styled.p`
  font-size: 15px;
  opacity: 0.9;
  line-height: 1.4;
  position: relative;
  z-index: 2;
`;

const FormHeaderBlock = styled.div`
  margin-bottom: 15px;
  padding: 25px 20px;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  border-radius: 8px;
  text-align: center;
  position: relative;
  @media (max-width: 600px) {
    padding: 16px 12px;
    margin-bottom: 12px;
  }
`;

const FormContainer = styled.div`
  padding: 25px 20px;
  overflow-y: auto;
  @media (max-width: 600px) {
    padding: 16px 12px;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  position: relative;
`;

const InputContainer = styled.div`
  position: relative;
  width: 100%;
  box-sizing: border-box;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #7f8c8d;
  z-index: 2;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 12px 15px 12px 45px;
  border: 2px solid #e0e6ed;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(5px);
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: rgba(255, 255, 255, 1);
  }

  &::placeholder {
    color: #bdc3c7;
  }
`;

const SendCodeBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s;
  }

  &:hover::before {
    left: 100%;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Footer = styled.div`
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  @media (max-width: 600px) {
    padding: 12px 16px;
  }
`;

const FooterText = styled.p`
  color: #6c757d;
  font-size: 12px;
  margin-bottom: 10px;
`;

const UgandaColors = styled.div`
  display: inline-flex;
  gap: 3px;
  margin-top: 5px;
`;

const ColorStripe = styled.div<{ color: string }>`
  width: 20px;
  height: 3px;
  border-radius: 1px;
  background: ${props => props.color};
`;

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [buttonText, setButtonText] = useState('Send Verification Code');
  const [testMode, setTestMode] = useState(false);
  const [testCode, setTestCode] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithCode, user, isAuthenticated } = useAuth();

  const from = location.state?.from?.pathname || '/dashboard';

  // Test credentials for development
  const testCredentials = [
    { phone: '+256782939854', username: 'commissioner', role: 'Ag. C/PAP' },
    { phone: '+256782190304', username: 'assistant_commissioner', role: 'Ag. AC/PAP'},
    { phone: '+256759977619', username: 'in_head', role: 'IN1' },
    { phone: '+256701732727', username: 'in_staff2', role: 'IN2' },
    { phone: '+256775212880', username: 'pas_head', role: 'PAS1' },
    { phone: '+256756250308', username: 'pas_staff4', role: 'PAS4' }
  ];

  useEffect(() => {
    if (isAuthenticated && user) {
      const userRole = user.role?.name?.toLowerCase();
      const isUnitHead = user.designation?.toLowerCase().includes('head');
      const isPasOrInUnit = user.department_unit?.id === 1 || user.department_unit?.id === 2;

      if (isUnitHead && isPasOrInUnit) {
        navigate('/roles/senior/dashboard', { replace: true });
        return;
      }
      switch (userRole) {
        case ROLES.SUPER_ADMIN:
          navigate('/roles/superadmin/dashboard', { replace: true });
          break;
        case ROLES.COMMISSIONER:
        case ROLES.ASSISTANT_COMMISSIONER:
        case ROLES.ECONOMIST:
          navigate('/roles/economist/dashboard', { replace: true });
          break;
        case ROLES.PRINCIPAL_ECONOMIST:
          navigate('/roles/principal/dashboard', { replace: true });
          break;
        case ROLES.SENIOR_ECONOMIST:
          navigate('/roles/senior/dashboard', { replace: true });
          break;
        default:
          navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const formatPhoneNumber = (value: string) => {
    let formatted = value.replace(/\D/g, '');
    if (formatted.length > 0) {
      if (formatted.startsWith('256')) {
        formatted = '+' + formatted;
      } else if (formatted.startsWith('0')) {
        formatted = '+256' + formatted.substring(1);
      } else if (!formatted.startsWith('+')) {
        formatted = '+256' + formatted;
      }
    }
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.trim() === '') {
      message.error('Please enter a valid phone number');
      return;
    }

    try {
      setIsLoading(true);
      setButtonText('Sending...');
      
      const response = await api.post('/users/send_login_code/', { phone_number: phone });
      
      if (response.data.is_test_mode) {
        setTestMode(true);
        setTestCode(response.data.test_code);
        message.success('Test mode: Code displayed below');
      } else {
        message.success('Verification code sent to your phone.');
      }
      
      setIsCodeSent(true);
      setButtonText('Code Sent! ✓');
      
      setTimeout(() => {
        setButtonText('Send Verification Code');
      }, 3000);
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to send code.');
      setButtonText('Send Verification Code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim() === '') {
      message.error('Please enter the verification code');
      return;
    }

    try {
      setIsLoading(true);
      await loginWithCode(phone, code);
      message.success('Login successful');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPhoneSelect = (testPhone: string) => {
    setPhone(testPhone);
  };

  return (
    <LoginContainer>
      <LoginCard>
        <LeftPanel>
          <TestCredentialsTitle>🧪 Test Credentials (Development)</TestCredentialsTitle>
          <TestCredentialsSubtitle>
            Select a test phone number to quickly log in without sending a code.
          </TestCredentialsSubtitle>
          <TestCredentialsGrid>
            {testCredentials.map((cred, index) => (
              <TestCredentialButton
                key={index}
                onClick={() => handleTestPhoneSelect(cred.phone)}
                isSelected={phone === cred.phone}
              >
                <CredentialUsername>{cred.username}</CredentialUsername>
                <CredentialPhone>{cred.phone}</CredentialPhone>
                <CredentialRole>{cred.role}</CredentialRole>
              </TestCredentialButton>
            ))}
          </TestCredentialsGrid>
          <DevelopmentNote>
            <strong>Note:</strong> This is a development environment.
            For production, users must receive a verification code via SMS.
          </DevelopmentNote>
        </LeftPanel>
        
        <RightPanel>
          <FormContainer>
            <FormHeaderBlock>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                margin: '0 auto 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 2
              }}>
                <img 
                  src="/Mofped_logo.png" 
                  alt="MOFPED Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '12px'
                  }}
                />
              </div>
              <SystemTitle style={{ margin: '0 0 6px 0', fontSize: '20px', color: 'white' }}>
                PAP Action Log
              </SystemTitle>
              <DepartmentInfo style={{ margin: 0, fontSize: 13 }}>
                Projects Analysis & Public Investment Department
              </DepartmentInfo>
            </FormHeaderBlock>

            {!isCodeSent ? (
              <form onSubmit={handleSendCode}>
                <FormGroup>
                  <InputContainer>
                    <InputIcon>📱</InputIcon>
                    <FormInput
                      type="tel"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChange={handlePhoneChange}
                      disabled={isLoading}
                      required
                    />
                  </InputContainer>
                </FormGroup>
                
                <SendCodeBtn type="submit" disabled={isLoading}>
                  {buttonText}
                </SendCodeBtn>
                
                {/* Spacing below button */}
                <div style={{ marginBottom: '80px' }}></div>
              </form>
            ) : (
              <div>
                <FormGroup>
                  <InputContainer>
                    <InputIcon>🔐</InputIcon>
                    <FormInput
                      type="text"
                      placeholder="Enter verification code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={isLoading}
                      maxLength={6}
                    />
                  </InputContainer>
                </FormGroup>
                
                {/* Test Code Display */}
                {testMode && testCode && (
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: '#fff3cd', 
                    borderRadius: '8px', 
                    border: '1px solid #ffeaa7',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: '#856404', marginBottom: '8px' }}>
                      🧪 Test Mode - Copy Your Code:
                    </div>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: '#856404',
                      letterSpacing: '3px',
                      fontFamily: 'monospace'
                    }}>
                      {testCode}
                    </div>
                  </div>
                )}
                
                <SendCodeBtn onClick={handleVerifyCode} disabled={isLoading}>
                  Verify & Login
                </SendCodeBtn>
              </div>
            )}
          </FormContainer>
          
          <Footer>
            <FooterText>Ministry of Finance, Planning & Economic Development</FooterText>
            <UgandaColors>
              <ColorStripe color="#000" />
              <ColorStripe color="#ffcd00" />
              <ColorStripe color="#ce1126" />
            </UgandaColors>
          </Footer>
        </RightPanel>
      </LoginCard>
    </LoginContainer>
  );
};

export default Login; 