import React, { useState, useEffect, useRef } from "react";
import "./FeedsDomain.css";

export default function FeedsDomain() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const API_BASE = "http://127.0.0.1:5000/api";

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/feeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch feeds");
      }

      const data = await res.json();
      setFeeds(data);
    } catch (error) {
      console.error("Error loading feeds:", error);
      alert("Failed to load feeds");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (feedId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/feeds/${feedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch feed details");
      }

      const data = await res.json();
      setSelectedFeed(data);
      setShowModal(true);
    } catch (error) {
      console.error("Error loading feed details:", error);
      alert("Failed to load feed details");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFeed(null);
  };

  const filteredFeeds = feeds.filter(
    (feed) =>
      feed.feed_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${feed.user_first_name} ${feed.user_last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="feeds-domain">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feeds-domain">
      <div className="feeds-header">
        <h2>All User Feeds</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by feed name, user name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredFeeds.length === 0 ? (
        <div className="no-feeds">
          <p>No feeds found</p>
        </div>
      ) : (
        <div className="feeds-table-container">
          <table className="feeds-table">
            <thead>
              <tr>
                <th>Feed Name</th>
                <th>User</th>
                <th>Email</th>
                <th>Upload Date</th>
                <th>Zones</th>
                <th>Analyzed</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeeds.map((feed) => (
                <tr key={feed.id}>
                  <td>
                    <div className="feed-name-cell">
                      <strong>{feed.feed_name}</strong>
                      <span className="feed-filename">{feed.filename}</span>
                    </div>
                  </td>
                  <td>{`${feed.user_first_name} ${feed.user_last_name}`}</td>
                  <td>{feed.user_email}</td>
                  <td>{formatDate(feed.upload_time)}</td>
                  <td>
                    <span className="badge">{feed.total_zones || 0}</span>
                  </td>
                  <td>
                    <span className="badge badge-success">
                      {feed.analyzed_zones || 0}
                    </span>
                  </td>
                  <td>
                    {feed.video_metadata?.duration
                      ? `${feed.video_metadata.duration}s`
                      : "N/A"}
                  </td>
                  <td>
                    <button
                      className="btn-view"
                      onClick={() => handleViewDetails(feed.id)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Feed Details Modal */}
      {showModal && selectedFeed && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Analysis Results - {selectedFeed.feed_name}</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            {/* Zones Section */}
            <div className="zones-section">
              <h3>Analysis Zones ({selectedFeed.zones.length})</h3>
              {selectedFeed.zones.length === 0 ? (
                <p className="no-data">No zones defined for this feed</p>
              ) : (
                <div className="zones-grid">
                  {selectedFeed.zones.map((zone, idx) => (
                    <div key={zone.zone_id} className="zone-card">
                      <div className="zone-header">
                        <h4>{zone.zone_name}</h4>
                        <span className="zone-badge">Zone {idx + 1}</span>
                      </div>
                      {/* Analysis Report */}
                      {zone.last_analysis && (
                        <div className="analysis-report">
                          <div className="report-stats">
                            <div className="stat-item">
                              <span className="stat-label">Average Count:</span>
                              <span className="stat-value">
                                {zone.last_analysis.avg_count?.toFixed(1) || '0.0'}
                              </span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Peak Occupancy:</span>
                              <span className="stat-value">
                                {zone.last_analysis.peak_count || 0}
                              </span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Total Persons Passed:</span>
                              <span className="stat-value stat-highlight">
                                {zone.last_analysis.total_persons_passed || zone.last_analysis.total_count || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!zone.last_analysis && (
                        <div className="no-analysis">
                          <span>Not analyzed yet</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
