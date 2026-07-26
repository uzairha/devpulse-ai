import { Octokit } from '@octokit/rest';

const getClient = (accessToken) => new Octokit({ auth: accessToken });

export const getUserRepos = async (accessToken) => {
  const octokit = getClient(accessToken);
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    visibility: 'all',
    sort: 'updated',
    per_page: 100,
  });
  return repos;
};

export const getRepoPullRequests = async (accessToken, owner, repo) => {
  const octokit = getClient(accessToken);
  const prs = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  });
  return prs;
};

export const getRepoCommits = async (accessToken, owner, repo) => {
  const octokit = getClient(accessToken);
  try {
    const commits = await octokit.paginate(octokit.repos.listCommits, {
      owner,
      repo,
      per_page: 100,
    });
    return commits;
  } catch (err) {
    if (err.status === 409) return [];
    throw err;
  }
};
