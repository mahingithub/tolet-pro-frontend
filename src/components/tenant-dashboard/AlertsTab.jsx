import React from 'react';
import SmartAlertsPage from '../Smartalertspage';

const AlertsTab = ({ tenantAlerts, tenantResolved, handleAlertAction }) => {
  return (
    <SmartAlertsPage
      alerts={tenantAlerts}
      resolved={tenantResolved}
      onMessageTenant={handleAlertAction}
    />
  );
};

export default AlertsTab;
