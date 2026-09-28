import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PayrollReport = () => {
  const [payrollData, setPayrollData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // We are fetching the data for Pay Period ID 1 (September 2026)
  const periodId = 1; 

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      
      // Fetch payroll records and join with staff and periods
      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          gross_pay,
          pension_employee,
          taxable_income,
          income_tax,
          net_pay,
          staff ( full_name, employee_code ),
          payroll_periods ( start_date, end_date )
        `)
        .eq('period_id', periodId);

      if (error) throw error;

      setPayrollData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading payroll data...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
  if (payrollData.length === 0) return <div style={{ padding: '20px' }}>No payroll records found for this period.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Payroll Report</h1>
      <p><strong>Period:</strong> {payrollData[0]?.payroll_periods?.start_date} to {payrollData[0]?.payroll_periods?.end_date}</p>

      {/* Loop through each staff member and give them their own table */}
      {payrollData.map((record, index) => (
        <div key={index} style={{ marginBottom: '30px', border: '1px solid #ccc', borderRadius: '8px', padding: '15px', backgroundColor: '#fff' }}>
          
          <h3 style={{ backgroundColor: '#f4f4f4', padding: '10px', marginTop: 0, borderRadius: '4px' }}>
            {record.staff.full_name} ({record.staff.employee_code})
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <tbody>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Gross Pay</th>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Number(record.gross_pay).toFixed(2)} ETB</td>
              </tr>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Pension (7%)</th>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', color: 'red' }}>-{Number(record.pension_employee).toFixed(2)} ETB</td>
              </tr>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Taxable Income</th>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Number(record.taxable_income).toFixed(2)} ETB</td>
              </tr>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Income Tax</th>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', color: 'red' }}>-{Number(record.income_tax).toFixed(2)} ETB</td>
              </tr>
              <tr style={{ fontWeight: 'bold', backgroundColor: '#e6f7ff' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Net Pay</th>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{Number(record.net_pay).toFixed(2)} ETB</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default PayrollReport;