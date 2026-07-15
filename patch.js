const fs = require('fs');
const file = 'client/src/employee/pages/EmployeeDashboard.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const insertion = `      const statsRes = await employeeApi.get(\`/employee-portal/ess/dashboard-stats?date=\${targetDate}\`);
      if (statsRes.data.success) {
        setDashboardStats(statsRes.data.stats);
        setActiveTimer(statsRes.data.activeTimer);
      }

      if (activeTab === 'timesheet') {
        const logsRes = await employeeApi.get(\`/employee-portal/ess/worklogs?limit=\${LOGS_PER_PAGE}&page=\${targetPage}&date=\${targetDate}\`);
        if (logsRes.data.success) {
          setWorkLogs(logsRes.data.logs);
          setLogsTotalPages(logsRes.data.pagination?.pages || 1);
          setLogsTotal(logsRes.data.pagination?.total || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load timer stats:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await employeeApi.get('/employee-portal/ess/leave-requests');
      if (res.data.success) {
        setLeaveRequests(res.data.leaveRequests);
        setLeaveBalances(res.data.leaveBalances || { CL: 0, SL: 0, PL: 0 });
        setLeavesUsed(res.data.leavesUsed || { CL: 0, SL: 0, PL: 0 });
        setLeaveBalancePeriod(res.data.leaveBalancePeriod || 'Year');
      }
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const activeRes = await employeeApi.get('/performance/active-cycle');
      if (activeRes.data.success && activeRes.data.cycle) {
        setActiveCycle(activeRes.data.cycle);
        const scRes = await employeeApi.get(\`/performance/scorecard/me/\${activeRes.data.cycle._id}\`);
        if (scRes.data.success) {
          setScorecard(scRes.data.review);
          setKpiTargets(scRes.data.targets || []);
        }
      }
      const histRes = await employeeApi.get('/employee-portal/ess/performance/history/me');
      if (histRes.data.success) {
        setPerformanceHistory(histRes.data.history || []);
      }
    } catch (err) {
      console.error('Failed to load performance data', err);
    }
  };

  const fetchTickets = async () => {
    try {
      setIsTicketsLoading(true);
      const res = await employeeApi.get('/employee-portal/ess/tickets');
      if (res.data.success) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      toast.error('Failed to load your assigned tickets');
    } finally {
      setIsTicketsLoading(false);
    }
  };

  const handleSelfReviewSubmit = async (e) => {
    e.preventDefault();
    if (selfReviewForm.selfRating < 1) { toast.error('Please select a rating (1-5 stars)'); return; }
    setIsSubmittingReview(true);
    try {
      const res = await employeeApi.post('/performance/review/self', {
        cycleId: activeCycle._id,
        ...selfReviewForm
      });
      if (res.data.success) {
        toast.success('Self-review submitted successfully!');
        setScorecard(res.data.review);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setLogsPage(1);
    fetchStatsAndLogs(newDate, 1);
  };

  const handleLogsPageChange = (newPage) => {
    setLogsPage(newPage);
    fetchStatsAndLogs(selectedDate, newPage);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProfile();
    fetchStatsAndLogs();
    if (activeTab === 'attendance') {
      fetchLeaveRequests();
    }
    if (activeTab === 'performance') {
      fetchPerformanceData();
    }
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  const handleUpdateBank = async (e) => {
    e.preventDefault();
    setBankErrors({});
    
    const errors = {};
    const nameRegex = /^[a-zA-Z\\s]+$/;
    if (!nameRegex.test(accountName)) errors.accountName = 'Must contain only letters and spaces.';
    if (!nameRegex.test(bankName)) errors.bankName = 'Must contain only letters and spaces.';
    
    const numberRegex = /^\\d+$/;
    if (!numberRegex.test(accountNumber)) errors.accountNumber = 'Must contain only numbers.';
    
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) errors.ifscCode = 'Invalid IFSC Code format. Expected e.g. HDFC0000123';

    if (Object.keys(errors).length > 0) {
      setBankErrors(errors);
      return;
    }

    try {
      const res = await employeeApi.put('/employee-portal/ess/profile', {
        bankDetails: { bankName, accountName, accountNumber, ifscCode }
      });
      if (res.data.success) {
        toast.success('Bank details updated successfully!');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bank details.');
    }
  };

  const handleClockInOut = async () => {
    try {
      const res = await employeeApi.post('/employee-portal/ess/attendance/clock');
      if (res.data.success) {
        toast.success(res.data.message);
        fetchProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Attendance request failed.');
    }
  };
`;

// Insert after line 101: `    try {`
// And we need to remove the broken `  };` at line 102
lines.splice(101, 1);
lines.splice(101, 0, insertion);

fs.writeFileSync(file, lines.join('\n'));
console.log('Patched correctly');
