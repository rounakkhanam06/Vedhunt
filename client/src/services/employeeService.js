import employeeApi from './employeeApi';

const employeeService = {
  login: async (email, password) => {
    const { data } = await employeeApi.post('/employee/auth/login', { email, password });
    return data;
  },
  logout: async () => {
    const { data } = await employeeApi.post('/employee/auth/logout');
    return data;
  },
  getMe: async () => {
    const { data } = await employeeApi.get('/employee/auth/me');
    return data;
  },
  getProfile: async () => {
    const { data } = await employeeApi.get('/employee-portal/ess/profile');
    return data;
  },
  updateProfile: async (payload) => {
    const { data } = await employeeApi.put('/employee-portal/ess/profile', payload);
    return data;
  },
  getDashboardStats: async (date) => {
    const { data } = await employeeApi.get(`/employee-portal/ess/dashboard-stats?date=${date}`);
    return data;
  },
  clockAttendance: async () => {
    const { data } = await employeeApi.post('/employee-portal/ess/attendance/clock');
    return data;
  },
  startTimer: async (payload) => {
    const { data } = await employeeApi.post('/employee-portal/ess/timer/start', payload);
    return data;
  },
  stopTimer: async (payload) => {
    const { data } = await employeeApi.post('/employee-portal/ess/timer/stop', payload);
    return data;
  },
  getWorkLogs: async (limit, page, date) => {
    const { data } = await employeeApi.get(`/employee-portal/ess/worklogs?limit=${limit}&page=${page}&date=${date}`);
    return data;
  },
  getLeaveRequests: async () => {
    const { data } = await employeeApi.get('/employee-portal/ess/leave-requests');
    return data;
  },
  submitLeaveRequest: async (payload) => {
    const { data } = await employeeApi.post('/employee-portal/ess/leave-requests', payload);
    return data;
  },
  getAssignedTickets: async () => {
    const { data } = await employeeApi.get('/employee-portal/ess/tickets');
    return data;
  },
};

export default employeeService;
