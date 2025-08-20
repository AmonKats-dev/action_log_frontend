import React from 'react';
import { Tag, Tooltip } from 'antd';
import { Delegation } from '../services/delegationService';

interface DelegationStatusProps {
  delegation?: Delegation | null;
  showDetails?: boolean;
}

const DelegationStatus: React.FC<DelegationStatusProps> = ({ 
  delegation, 
  showDetails = false 
}) => {
  if (!delegation) {
    return <Tag color="default">No Delegation</Tag>;
  }

  if (!delegation.is_active) {
    return <Tag color="red">Revoked</Tag>;
  }

  const isExpired = new Date(delegation.expires_at) < new Date();
  
  if (isExpired) {
    return <Tag color="orange">Expired</Tag>;
  }

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'leave':
        return 'blue';
      case 'other':
        return 'green';
      default:
        return 'default';
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'leave':
        return 'Leave';
      case 'other':
        return 'Other';
      default:
        return reason;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const timeUntilExpiry = new Date(delegation.expires_at).getTime() - new Date().getTime();
  const hoursUntilExpiry = Math.ceil(timeUntilExpiry / (1000 * 60 * 60));

  let expiryColor = 'green';
  if (hoursUntilExpiry <= 24) {
    expiryColor = 'orange';
  }
  if (hoursUntilExpiry <= 1) {
    expiryColor = 'red';
  }

  return (
    <div>
      <Tag color={getReasonColor(delegation.reason)}>
        {getReasonLabel(delegation.reason)}
      </Tag>
      
      {showDetails && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
          <div>Expires: {formatDate(delegation.expires_at)}</div>
          <div>
            <Tag color={expiryColor}>
              {hoursUntilExpiry > 0 
                ? `${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''} left`
                : 'Expiring soon'
              }
            </Tag>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelegationStatus;
