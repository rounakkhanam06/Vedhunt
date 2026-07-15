const fs = require('fs');
const file = 'client/src/employee/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const fixedTop = `import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import employeeApi from '../../services/employeeApi';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert, Trophy, Star, Target, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import employeeAvatar from '../../assets/033a13e9af4efbb035a04c3777c4934d-removebg-preview.png';

import RealTimeTimer from '../components/RealTimeTimer';

const StarRating = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={12} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
    ))}
  </div>
);

const EmployeeDashboard = () => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Advanced Timesheet State
  const [dashboardStats, setDashboardStats] = useState(null);
  const [workLogs, setWorkLogs] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const LOGS_PER_PAGE = 10;

  // Leave Request State
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({ CL: 0, SL: 0, PL: 0 });
  const [leavesUsed, setLeavesUsed] = useState({ CL: 0, SL: 0, PL: 0 });
  const [tickets, setTickets] = useState([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('All');
  const [leaveBalancePeriod, setLeaveBalancePeriod] = useState('Year');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Lock background scroll when leave modal is open
  useEffect(() => {
    if (showLeaveModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLeaveModal]);`;

// Remove lines 0 to 87
lines.splice(0, 88);

// Add the fixed top
content = fixedTop + '\n' + lines.join('\n');

fs.writeFileSync(file, content);
console.log('Fixed EmployeeDashboard top');
