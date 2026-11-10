'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TransportVehicle {
  id: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
}

interface Student {
  id: string;
  name: string;
}

interface StudentBusSubscription {
  id: string;
  stopName: string;
  status: string;
  student: Student;
}

interface TransportRoute {
  id: string;
  routeName: string;
  pickupTime: string;
  dropoffTime: string;
  vehicle?: TransportVehicle;
  subscriptions: StudentBusSubscription[];
}

export default function TransportDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [hasFeature, setHasFeature] = useState(true);
  const [userRole, setUserRole] = useState<string>('school_admin');
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Vehicle Form
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [creatingVehicle, setCreatingVehicle] = useState(false);

  // Route Form
  const [routeName, setRouteName] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [pickupTime, setPickupTime] = useState('07:00 AM');
  const [dropoffTime, setDropoffTime] = useState('03:30 PM');
  const [creatingRoute, setCreatingRoute] = useState(false);

  // Subscription Form
  const [subStudentId, setSubStudentId] = useState('');
  const [subRouteId, setSubRouteId] = useState('');
  const [stopName, setStopName] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTransportData();
  }, [slug]);

  async function fetchTransportData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/transport?slug=${slug}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setHasFeature(false);
        setLoading(false);
        return;
      }
      setHasFeature(data.hasFeature);
      if (data.userRole) setUserRole(data.userRole);
      setVehicles(data.vehicles || []);
      setRoutes(data.routes || []);
      setStudents(data.students || []);

      if (data.vehicles?.length) setVehicleId(data.vehicles[0].id);
      if (data.routes?.length) setSubRouteId(data.routes[0].id);
      if (data.students?.length) setSubStudentId(data.students[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleNo || !driverName || !driverPhone) return;
    setCreatingVehicle(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_vehicle',
          slug,
          vehicleData: { vehicleNo, driverName, driverPhone, capacity },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add vehicle');
      setFeedback({ type: 'success', text: `School bus ${vehicleNo} registered!` });
      setVehicleNo('');
      setDriverName('');
      setDriverPhone('');
      fetchTransportData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreatingVehicle(false);
    }
  }

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!routeName) return;
    setCreatingRoute(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_route',
          slug,
          routeData: { routeName, vehicleId, pickupTime, dropoffTime },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add transport route');
      setFeedback({ type: 'success', text: `Route "${routeName}" created!` });
      setRouteName('');
      fetchTransportData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreatingRoute(false);
    }
  }

  async function handleSubscribeStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!subStudentId || !subRouteId) return;
    setSubscribing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tenant/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe_student',
          slug,
          subscriptionData: { studentId: subStudentId, routeId: subRouteId, stopName },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to subscribe student to bus route');
      setFeedback({ type: 'success', text: 'Student assigned to bus route pass!' });
      setStopName('');
      fetchTransportData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubscribing(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500 font-mono text-sm">Loading Fleet Tracking Engine...</div>;
  }

  if (!hasFeature) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center space-x-3 text-amber-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold">School Bus & Fleet Tracking Feature Locked</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          School Bus & Fleet Tracking allows managing bus vehicles, driver assignments, morning/afternoon pickup routes, and student transportation passes. Upgrade to Enterprise plan to enable bus tracking.
        </p>
        <Link
          href={`/${slug}/dashboard/subscription`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition-all"
        >
          Upgrade Subscription Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">School Bus & Fleet Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage school buses, driver rosters, pickup/dropoff schedules, and student bus subscriptions.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <span className="w-2 h-2 mr-2 bg-blue-500 rounded-full animate-pulse"></span>
          GPS Tracking Active
        </span>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Admin Operations Grid (School Admin Only) */}
      {userRole === 'school_admin' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Register Vehicle */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Register Bus Vehicle
          </h2>
          <form onSubmit={handleCreateVehicle} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Vehicle / Reg No.</label>
              <input
                type="text"
                placeholder="e.g. BUS-01 (LAG-567-AA)"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Driver Name</label>
              <input
                type="text"
                placeholder="e.g. Mr. Timothy Okon"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Driver Phone</label>
              <input
                type="text"
                placeholder="e.g. +2348031234567"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Seating Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={creatingVehicle}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition"
            >
              {creatingVehicle ? 'Saving...' : 'Register Vehicle'}
            </button>
          </form>
        </div>

        {/* Create Route */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Create Bus Route
          </h2>
          <form onSubmit={handleCreateRoute} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Route Name</label>
              <input
                type="text"
                placeholder="e.g. Ikeja - Maryland Express"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Assign Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              >
                <option value="">No Vehicle Assigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNo} ({v.driverName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Pickup Time</label>
              <input
                type="text"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Dropoff Time</label>
              <input
                type="text"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={creatingRoute}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition"
            >
              {creatingRoute ? 'Saving...' : 'Create Route'}
            </button>
          </form>
        </div>

        {/* Subscribe Student Pass */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center">
            <svg className="w-5 h-5 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z" />
            </svg>
            Assign Bus Pass
          </h2>
          <form onSubmit={handleSubscribeStudent} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Select Student</label>
              <select
                value={subStudentId}
                onChange={(e) => setSubStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Select Bus Route</label>
              <select
                value={subRouteId}
                onChange={(e) => setSubRouteId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Bus Stop Designation</label>
              <input
                type="text"
                placeholder="e.g. Allen Junction Bus Stop"
                value={stopName}
                onChange={(e) => setStopName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={subscribing}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition"
            >
              {subscribing ? 'Saving...' : 'Issue Bus Pass'}
            </button>
          </form>
        </div>
      </div>
    )}

      {/* Fleet Vehicles & Bus Rosters Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-slate-900">Active Bus Routes & Student Bus Rosters ({routes.length})</h2>
        {routes.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-4">No transport routes created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {routes.map((route) => (
              <div key={route.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{route.routeName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vehicle: {route.vehicle ? `${route.vehicle.vehicleNo} (${route.vehicle.driverName})` : 'Unassigned'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                    {route.subscriptions.length} Students
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex space-x-4 border-t border-b border-slate-200 py-2">
                  <span>Pickup: <strong className="text-slate-900">{route.pickupTime}</strong></span>
                  <span>Dropoff: <strong className="text-slate-900">{route.dropoffTime}</strong></span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Student Bus Pass Holders</h4>
                  {route.subscriptions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No students assigned to this bus route.</p>
                  ) : (
                    <div className="space-y-1">
                      {route.subscriptions.map((sub) => (
                        <div key={sub.id} className="bg-white px-3 py-1.5 rounded border border-slate-200 text-xs flex justify-between">
                          <span className="font-bold text-slate-800">{sub.student.name}</span>
                          <span className="text-slate-500 font-mono">{sub.stopName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
