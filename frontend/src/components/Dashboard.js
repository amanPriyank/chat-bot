import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  MessageCircle, 
  FileText, 
  TrendingUp, 
  Clock,
  Plus,
  ArrowRight,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Shield,
  Zap
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalApplications: 0,
    activeApplications: 0,
    completedChats: 0,
    pendingApplications: 0
  });
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch applications
        const applicationsResponse = await axios.get('/api/loan/applications?limit=5');
        const applications = applicationsResponse.data.data.applications;
        
        // Fetch chat sessions
        const chatsResponse = await axios.get('/api/chat/sessions?limit=5');
        const chats = chatsResponse.data.data.chats;

        // Calculate stats
        const totalApplications = applicationsResponse.data.data.totalApplications;
        const activeApplications = applications.filter(app => 
          ['draft', 'submitted', 'under_review'].includes(app.status)
        ).length;
        const pendingApplications = applications.filter(app => 
          app.status === 'submitted' || app.status === 'under_review'
        ).length;

        setStats({
          totalApplications,
          activeApplications,
          completedChats: chats.length,
          pendingApplications
        });

        setRecentApplications(applications);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'submitted':
        return 'text-blue-600 bg-blue-100';
      case 'under_review':
        return 'text-yellow-600 bg-yellow-100';
      case 'draft':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4" />;
      case 'submitted':
      case 'under_review':
        return <Clock className="h-4 w-4" />;
      case 'draft':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-secondary-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-secondary-600">
              Your Fundobaba dashboard - Quick pay-day loans backed by RBI-registered NBFC UY Fincorp
            </p>
          </div>
        </div>
      </div>

      {/* Fundobaba Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
          <div className="flex items-center">
            <div className="p-3 bg-primary-600 rounded-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-primary-900">Fast & Easy</h3>
              <p className="text-sm text-primary-700">Quick approval in 24-48 hours</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-600 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-green-900">RBI Registered</h3>
              <p className="text-sm text-green-700">Backed by UY Fincorp NBFC</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-600 rounded-lg">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-blue-900">24/7 Support</h3>
              <p className="text-sm text-blue-700">Always here to help you</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Total Applications</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.totalApplications}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Active Applications</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.activeApplications}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Chat Sessions</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.completedChats}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Pending Review</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.pendingApplications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/chat"
              className="flex items-center justify-between p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="flex items-center">
                <MessageCircle className="h-5 w-5 text-primary-600 mr-3" />
                <span className="font-medium text-secondary-900">Chat with Assistant</span>
              </div>
              <ArrowRight className="h-4 w-4 text-secondary-400" />
            </Link>
            
            <Link
              to="/applications"
              className="flex items-center justify-between p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="flex items-center">
                <Plus className="h-5 w-5 text-primary-600 mr-3" />
                <span className="font-medium text-secondary-900">Apply for Pay-day Loan</span>
              </div>
              <ArrowRight className="h-4 w-4 text-secondary-400" />
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Loan Information</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-secondary-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-secondary-900">Loan Amount</span>
                <span className="text-sm text-secondary-600">₹1,000 - ₹50,000</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-secondary-900">Interest Rate</span>
                <span className="text-sm text-secondary-600">1-3% per month</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-secondary-900">Processing Time</span>
                <span className="text-sm text-secondary-600">24-48 hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Applications Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">Recent Applications</h3>
          <Link
            to="/applications"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View all
          </Link>
        </div>

        {recentApplications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {recentApplications.map((application) => (
                  <tr key={application._id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-secondary-900">
                        {application.applicationNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-secondary-400 mr-1" />
                        <span className="text-sm text-secondary-900">
                          ₹{application.amount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-secondary-900">
                        {application.purpose}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                        {getStatusIcon(application.status)}
                        <span className="ml-1">{application.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-secondary-400 mr-1" />
                        {new Date(application.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-secondary-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary-900">No applications yet</h3>
            <p className="mt-1 text-sm text-secondary-500">
              Get started with your first pay-day loan application.
            </p>
            <div className="mt-6">
              <Link
                to="/applications"
                className="btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Apply Now
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 