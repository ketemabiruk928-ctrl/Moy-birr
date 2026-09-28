import React, { useEffect, useState } from 'react';
// FIXED: Importing from your existing Supabase client
import { supabase } from '@/integrations/supabase/client';

interface PayrollRecord {
  gross_pay: number;
  pension_employee: number;
  taxable_income: number;
  income_tax: number;
  net_pay: number;
  staff: {
    full_name: string;
    employee_code: string;
  };
  payroll_periods: {
    start_date: string;
    end_date: string;
  };
}

export function PayrollReport() {
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We are fetching the data for Pay Period ID 1 (September 2026)
  const periodId = 1;

  useEffect(() => {
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

        setPayrollData(data as unknown as PayrollRecord[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayroll();
  }, []);

  if (loading) return <div className="p-5 text-center text-gray-500">Loading payroll data...</div>;
  if (error) return <div className="p-5 text-center text-red-500">Error: {error}</div>;
  if (payrollData.length === 0) return <div className="p-5 text-center text-gray-500">No payroll records found for this period.</div>;

  return (
    <div className="p-5 font-sans">
      <h1 className="text-2xl font-bold mb-2">Payroll Report</h1>
      <p className="text-sm text-gray-600 mb-6">
        <strong>Period:</strong> {payrollData[0]?.payroll_periods?.start_date} to {payrollData[0]?.payroll_periods?.end_date}
      </p>

      {/* Loop through each staff member and give them their own table */}
      {payrollData.map((record, index) => (
        <div key={index} className="mb-8 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          
          <h3 className="bg-gray-100 px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">
            {record.staff?.full_name} ({record.staff?.employee_code})
          </h3>

          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-gray-600 font-medium">Gross Pay</th>
                <td className="px-4 py-3 font-semibold">{Number(record.gross_pay).toFixed(2)} ETB</td>
              </tr>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-gray-600 font-medium">Pension (7%)</th>
                <td className="px-4 py-3 text-red-500 font-semibold">-{Number(record.pension_employee).toFixed(2)} ETB</td>
              </tr>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-gray-600 font-medium">Taxable Income</th>
                <td className="px-4 py-3">{Number(record.taxable_income).toFixed(2)} ETB</td>
              </tr>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-gray-600 font-medium">Income Tax</th>
                <td className="px-4 py-3 text-red-500 font-semibold">-{Number(record.income_tax).toFixed(2)} ETB</td>
              </tr>
              <tr className="bg-blue-50 font-bold">
                <th className="px-4 py-3 text-blue-900">Net Pay</th>
                <td className="px-4 py-3 text-blue-900">{Number(record.net_pay).toFixed(2)} ETB</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default PayrollReport;