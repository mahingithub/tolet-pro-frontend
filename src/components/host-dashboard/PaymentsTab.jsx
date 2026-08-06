import React from 'react';
import PendingRentPayments from '../payments/PendingRentPayments';
import PaymentSettings from '../payments/PaymentSettings';
import RentPaymentHistory from '../payments/RentPaymentHistory';

const PaymentsTab = ({ refreshPendingRent, setPaymentMethods }) => {
  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500 space-y-8 pb-10">
      <PendingRentPayments onChange={refreshPendingRent} />
      <div className="h-px bg-gray-100" />
      <PaymentSettings onChange={setPaymentMethods} />
      <div className="h-px bg-gray-100" />
      <RentPaymentHistory />
    </div>
  );
};

export default PaymentsTab;
