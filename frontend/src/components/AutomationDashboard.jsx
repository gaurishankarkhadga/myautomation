import React, { useState, useEffect } from 'react';
import { automationService } from '../services/instagram';
import '../styles/Dashboard.css';

const AutomationDashboard = () => {
    const [scheduledPosts, setScheduledPosts] = useState([]);
    const [newPost, setNewPost] = useState({
        caption: '',
        mediaUrl: '',
        scheduledTime: ''
    });
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadScheduledPosts();
    }, []);

    const loadScheduledPosts = async () => {
        try {
            const response = await automationService.getScheduledPosts();
            setScheduledPosts(response.scheduledPosts || []);
        } catch (error) {
            console.error('Failed to load posts:', error);
        }
    };

    const handleSchedulePost = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await automationService.createScheduledPost(newPost);
            setNewPost({ caption: '', mediaUrl: '', scheduledTime: '' });
            setShowForm(false);
            loadScheduledPosts();
            alert('Post scheduled successfully!');
        } catch (error) {
            alert('Failed to schedule post: ' + error.error);
        } finally {
            setLoading(false);
        }
    };

    const handlePublishNow = async (id) => {
        if (!confirm('Publish this post now?')) return;
        try {
            await automationService.publishNow(id);
            alert('Post published successfully!');
            loadScheduledPosts();
        } catch (error) {
            alert('Failed to publish: ' + error.error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Cancel this scheduled post?')) return;
        try {
            await automationService.deleteScheduledPost(id);
            loadScheduledPosts();
        } catch (error) {
            alert('Failed to delete: ' + error.error);
        }
    };

    return (
        <div className="automation-dashboard">
            <div className="dashboard-header">
                <h1>Post Automation</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary">
                    {showForm ? 'Cancel' : 'Schedule New Post'}
                </button>
            </div>

            {showForm && (
                <form className="schedule-form" onSubmit={handleSchedulePost}>
                    <div className="form-group">
                        <label>Media URL</label>
                        <input
                            type="url"
                            value={newPost.mediaUrl}
                            onChange={(e) => setNewPost({ ...newPost, mediaUrl: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Caption</label>
                        <textarea
                            value={newPost.caption}
                            onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                            placeholder="Write your caption..."
                            rows="4"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Schedule Time</label>
                        <input
                            type="datetime-local"
                            value={newPost.scheduledTime}
                            onChange={(e) => setNewPost({ ...newPost, scheduledTime: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" disabled={loading} className="btn-submit">
                        {loading ? 'Scheduling...' : 'Schedule Post'}
                    </button>
                </form>
            )}

            <div className="scheduled-posts">
                <h2>Scheduled Posts ({scheduledPosts.length})</h2>
                {scheduledPosts.length === 0 ? (
                    <p className="empty-state">No scheduled posts yet</p>
                ) : (
                    <div className="posts-grid">
                        {scheduledPosts.map(post => (
                            <div key={post._id} className={`post-card ${post.status}`}>
                                <img src={post.mediaUrl} alt="Post" className="post-image" />
                                <div className="post-details">
                                    <p className="caption">{post.caption}</p>
                                    <p className="schedule-time">
                                        {new Date(post.scheduledTime).toLocaleString()}
                                    </p>
                                    <span className={`status-badge ${post.status}`}>{post.status}</span>
                                </div>
                                {post.status === 'PENDING' && (
                                    <div className="post-actions">
                                        <button onClick={() => handlePublishNow(post._id)} className="btn-publish">
                                            Publish Now
                                        </button>
                                        <button onClick={() => handleDelete(post._id)} className="btn-delete">
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutomationDashboard;
