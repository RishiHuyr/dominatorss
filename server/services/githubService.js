const axios = require('axios');

class GithubService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      }
    });
  }

  // Helper to get headers with token
  getHeaders(token) {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    const authToken = token || process.env.GITHUB_TOKEN;
    if (authToken) {
      headers.Authorization = `token ${authToken}`;
    }
    return headers;
  }

  async fetchIssue(owner, repo, issueNumber, token = null) {
    try {
      const headers = this.getHeaders(token);
      const [issueRes, commentsRes] = await Promise.all([
        this.client.get(`/repos/${owner}/${repo}/issues/${issueNumber}`, { headers }),
        this.client.get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { headers })
      ]);

      const issue = issueRes.data;
      const comments = commentsRes.data.map(c => ({
        author: c.user.login,
        body: c.body,
        createdAt: c.created_at
      }));

      return {
        id: `${owner}/${repo}#${issueNumber}`,
        repo: `${owner}/${repo}`,
        number: issueNumber,
        title: issue.title,
        body: issue.body || 'No description provided.',
        author: issue.user.login,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        createdAt: new Date(issue.created_at),
        commentsData: comments
      };
    } catch (error) {
      console.error('Error fetching issue from GitHub:', error.message);
      if (error.response && error.response.status === 404) {
        throw new Error('Issue not found on GitHub.');
      } else if (error.response && error.response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please add GITHUB_TOKEN to .env');
      }
      throw error;
    }
  }

  async fetchIssuesBatch(owner, repo, limit = 50, token = null) {
    try {
      const headers = this.getHeaders(token);
      const res = await this.client.get(`/repos/${owner}/${repo}/issues?state=open&per_page=${limit}`, { headers });
      // Filter out pull requests which are also returned by the issues endpoint
      const issues = res.data.filter(i => !i.pull_request).map(issue => ({
        id: `${owner}/${repo}#${issue.number}`,
        repo: `${owner}/${repo}`,
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        author: issue.user.login,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        createdAt: new Date(issue.created_at)
      }));
      return issues;
    } catch (error) {
      console.error('Error fetching bulk issues:', error.message);
      throw error;
    }
  }
}

module.exports = new GithubService();
