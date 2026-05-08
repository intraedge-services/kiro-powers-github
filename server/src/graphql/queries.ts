/**
 * GitHub Projects V2 GraphQL Queries (Read Operations)
 */

export const GET_USER_PROJECTS = `
  query GetUserProjects($login: String!, $first: Int!) {
    user(login: $login) {
      projectsV2(first: $first) {
        nodes {
          id
          title
          number
          url
          shortDescription
          closed
          items { totalCount }
        }
      }
    }
  }
`;

export const GET_ORG_PROJECTS = `
  query GetOrgProjects($login: String!, $first: Int!) {
    organization(login: $login) {
      projectsV2(first: $first) {
        nodes {
          id
          title
          number
          url
          shortDescription
          closed
          items { totalCount }
        }
      }
    }
  }
`;

export const GET_PROJECT = `
  query GetProject($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
        title
        number
        url
        shortDescription
        closed
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options { id name color }
            }
            ... on ProjectV2IterationField {
              id
              name
              dataType
              configuration {
                iterations { id title startDate duration }
              }
            }
          }
        }
        views(first: 10) {
          nodes { id name layout }
        }
        items { totalCount }
      }
    }
  }
`;

export const GET_PROJECT_ITEMS = `
  query GetProjectItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue {
                title
                number
                state
                url
                assignees(first: 5) { nodes { login } }
                labels(first: 5) { nodes { name } }
              }
              ... on PullRequest {
                title
                number
                state
                url
              }
              ... on DraftIssue {
                title
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  field { ... on ProjectV2SingleSelectField { name } }
                  name
                }
                ... on ProjectV2ItemFieldTextValue {
                  field { ... on ProjectV2Field { name } }
                  text
                }
                ... on ProjectV2ItemFieldNumberValue {
                  field { ... on ProjectV2Field { name } }
                  number
                }
                ... on ProjectV2ItemFieldDateValue {
                  field { ... on ProjectV2Field { name } }
                  date
                }
                ... on ProjectV2ItemFieldIterationValue {
                  field { ... on ProjectV2IterationField { name } }
                  title
                  startDate
                  duration
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_STATUS_FIELD = `
  query GetStatusField($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name color }
          }
        }
      }
    }
  }
`;

export const GET_PROJECT_FIELDS = `
  query GetProjectFields($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 30) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options { id name color }
            }
            ... on ProjectV2IterationField {
              id
              name
              dataType
              configuration {
                iterations { id title startDate duration }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_PROJECT_VIEWS = `
  query GetProjectViews($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        views(first: 20) {
          nodes {
            id
            name
            layout
          }
        }
      }
    }
  }
`;

export const GET_PROJECT_WORKFLOWS = `
  query GetProjectWorkflows($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        workflows(first: 20) {
          nodes {
            id
            name
            enabled
            number
          }
        }
      }
    }
  }
`;
