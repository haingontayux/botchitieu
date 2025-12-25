
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, CategoryIcons } from '../types';
import { formatCurrency, analyzeFinancialAdvice } from '../services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface StatisticsProps {
  transactions: Transaction[];
}

const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#14B8A6'];

export const Statistics: React.FC<StatisticsProps> = ({ transactions }) => {
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  
  // Smart Analysis States
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    if (period === 'all') return transactions;
    if (period === 'year') return transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
    // Month
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [transactions, period]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    return { income, expense };
  }, [filteredTransactions]);

  // --- Comparisons (Week/Month) ---
  const comparisonStats = useMemo(() => {
      const now = new Date();
      
      // Calculate start dates
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay()); // Sunday
      
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      let thisWeekSum = 0;
      let lastWeekSum = 0;
      let thisMonthSum = 0;
      let lastMonthSum = 0;

      transactions.forEach(t => {
          if (t.type === TransactionType.EXPENSE) {
             const d = new Date(t.date);
             // Week Logic
             if (d >= startOfThisWeek) thisWeekSum += t.amount;
             else if (d >= startOfLastWeek && d < startOfThisWeek) lastWeekSum += t.amount;

             // Month Logic
             if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonthSum += t.amount;
             else if (d.getMonth() === startOfLastMonth.getMonth() && d.getFullYear() === startOfLastMonth.getFullYear()) lastMonthSum += t.amount;
          }
      });

      return {
          thisWeek: thisWeekSum,
          lastWeek: lastWeekSum,
          weekDiff: lastWeekSum === 0 ? 100 : ((thisWeekSum - lastWeekSum) / lastWeekSum) * 100,
          thisMonth: thisMonthSum,
          lastMonth: lastMonthSum,
          monthDiff: lastMonthSum === 0 ? 100 : ((thisMonthSum - lastMonthSum) / lastMonthSum) * 100
      };
  }, [transactions]);


  // --- Data for Daily Bar Chart ---
  const dailyData = useMemo(() => {
      if (period === 'all' || period === 'year') return []; // Only for month view to keep it readable

      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const data = new Array(daysInMonth).fill(0).map((_, i) => ({ day: i + 1, income: 0, expense: 0 }));

      filteredTransactions.forEach(t => {
          const d = new Date(t.date);
          const dayIndex = d.getDate() - 1;
          if (t.type === TransactionType.INCOME) data[dayIndex].income += t.amount;
          else data[dayIndex].expense += t.amount;
      });

      return data;
  }, [filteredTransactions, period]);

  // Data for Comparison Bar Chart (Income vs Expense)
  const comparisonData = useMemo(() => {
      return [
          { name: 'Thu nhập', value: stats.income, fill: '#10B981' },
          { name: 'Chi tiêu', value: stats.expense, fill: '#F43F5E' }
      ];
  }, [stats]);

  // Data for Pie Chart (Dynamic based on chartType)
  const categoryData = useMemo(() => {
    const typeFilter = chartType === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME;
    const targetTransactions = filteredTransactions.filter(t => t.type === typeFilter);
    const map = new Map<string, number>();
    
    targetTransactions.forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, icon: CategoryIcons[name] || '📦' }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, chartType]);

  const handleAIAnalysis = async () => {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      try {
          const result = await analyzeFinancialAdvice(transactions);
          setAnalysisResult(result);
      } catch (e) {
          setAnalysisResult("Lỗi khi phân tích. Vui lòng thử lại.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0 relative">
      
      {/* Time Filters */}
      <div className="flex justify-between items-center">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button onClick={() => setPeriod('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Tháng này</button>
            <button onClick={() => setPeriod('year')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Năm nay</button>
            <button onClick={() => setPeriod('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Tất cả</button>
        </div>
        <button 
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className="flex items-center space-x-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
            {isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <span>🔮 AI Phân tích</span>
            )}
        </button>
      </div>

      {/* AI Analysis Result Card */}
      {analysisResult && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🧐</span>
                  <h3 className="font-bold text-indigo-800">Góc nhìn chuyên gia</h3>
              </div>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {analysisResult}
              </div>
          </div>
      )}

      {/* Period Comparisons (Cards) */}
      <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-start">
                 <p className="text-slate-400 text-xs font-bold uppercase">Tuần này</p>
                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${comparisonStats.weekDiff > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {comparisonStats.weekDiff > 0 ? '▲' : '▼'} {Math.abs(Math.round(comparisonStats.weekDiff))}%
                 </span>
             </div>
             <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(comparisonStats.thisWeek)}</p>
             <p className="text-[10px] text-slate-400 mt-1">Vs tuần trước: {formatCurrency(comparisonStats.lastWeek)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-start">
                 <p className="text-slate-400 text-xs font-bold uppercase">Tháng này</p>
                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${comparisonStats.monthDiff > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {comparisonStats.monthDiff > 0 ? '▲' : '▼'} {Math.abs(Math.round(comparisonStats.monthDiff))}%
                 </span>
             </div>
             <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(comparisonStats.thisMonth)}</p>
             <p className="text-[10px] text-slate-400 mt-1">Vs tháng trước: {formatCurrency(comparisonStats.lastMonth)}</p>
          </div>
      </div>

      {/* Daily Chart (Only visible in 'Month' view) */}
      {period === 'month' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-4">Biểu đồ ngày (Tháng này)</h3>
             <div className="h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} barGap={0}>
                       <XAxis dataKey="day" tick={{fontSize: 10}} axisLine={false} tickLine={false} interval={2} />
                       <Tooltip 
                         cursor={{fill: '#f8fafc'}}
                         formatter={(value: number) => formatCurrency(value)}
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                       />
                       <Bar dataKey="income" name="Thu nhập" fill="#10B981" radius={[2, 2, 0, 0]} stackId="a" />
                       <Bar dataKey="expense" name="Chi tiêu" fill="#F43F5E" radius={[2, 2, 0, 0]} stackId="a" />
                    </BarChart>
                 </ResponsiveContainer>
             </div>
          </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* Comparison Chart */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">Tổng quan {period === 'month' ? 'Tháng' : period === 'year' ? 'Năm' : 'Tất cả'}</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={comparisonData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                   <YAxis hide />
                   <Tooltip 
                     formatter={(value: number) => formatCurrency(value)}
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                   />
                   <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Category Chart with Toggle */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
           <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-slate-800">Cơ cấu {chartType === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập'}</h3>
               <div className="flex bg-slate-100 p-0.5 rounded-lg">
                   <button onClick={() => setChartType('EXPENSE')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === 'EXPENSE' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>Chi</button>
                   <button onClick={() => setChartType('INCOME')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === 'INCOME' ? 'bg-white text-green-500 shadow-sm' : 'text-slate-400'}`}>Thu</button>
               </div>
           </div>

           {categoryData.length > 0 ? (
             <div className="flex flex-col">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                          data={categoryData} 
                          cx="50%" cy="50%" 
                          innerRadius={60} outerRadius={80} 
                          paddingAngle={5} 
                          dataKey="value"
                          onClick={(data) => setSelectedCategory(data.name)}
                          cursor="pointer"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                  {categoryData.map((entry, index) => (
                    <button 
                        key={index} 
                        onClick={() => setSelectedCategory(entry.name)}
                        className="w-full flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors group"
                    >
                       <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-slate-600 mr-1 text-lg">{entry.icon}</span>
                          <span className="text-slate-600 group-hover:text-indigo-600 font-medium">{entry.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{formatCurrency(entry.value)}</span>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                       </div>
                    </button>
                  ))}
                </div>
             </div>
           ) : (
             <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2 min-h-[300px]">
                <span className="text-3xl opacity-30">📊</span>
                <span className="text-sm">Chưa có dữ liệu {chartType === 'EXPENSE' ? 'chi' : 'thu'}</span>
             </div>
           )}
         </div>
      </div>

      {/* Detail Modal */}
      {selectedCategory && (
        <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedCategory(null)}
        >
            <div 
                className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{CategoryIcons[selectedCategory] || '📦'}</span>
                        <div>
                            <h3 className="font-bold text-slate-800">{selectedCategory}</h3>
                            <p className="text-xs text-slate-500">Chi tiết giao dịch</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedCategory(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {filteredTransactions.filter(t => t.category === selectedCategory && (t.type === (chartType === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME))).map(t => (
                        <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{t.description}</p>
                                <p className="text-xs text-slate-400">{new Date(t.date).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <span className={`font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-800'}`}>
                                {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
