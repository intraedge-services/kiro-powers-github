/**
 * GitHub Projects V2 GraphQL Mutations (Write Operations)
 */

export const CREATE_PROJECT = `
  mutation CreateProject($ownerId: ID!, $title: String!) {
    createProjectV2(input: { ownerId: $ownerId, title: $title }) {
      projectV2 {
        id
        title
        number
        url
      }
    }
  }
`;

export const UPDATE_PROJECT = `
  mutation UpdateProject($projectId: ID!, $title: String, $shortDescription: String, $public: Boolean) {
    updateProjectV2(input: { projectId: $projectId, title: $title, shortDescription: $shortDescription, public: $public }) {
      projectV2 {
        id
        title
        url
      }
    }
  }
`;

export const DELETE_PROJECT = `
  mutation DeleteProject($projectId: ID!) {
    deleteProjectV2(input: { projectId: $projectId }) {
      projectV2 { id }
    }
  }
`;

export const ADD_ITEM_TO_PROJECT = `
  mutation AddItemToProject($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item {
        id
        content {
          ... on Issue { title number }
          ... on PullRequest { title number }
        }
      }
    }
  }
`;

export const ADD_DRAFT_ITEM = `
  mutation AddDraftItem($projectId: ID!, $title: String!, $body: String) {
    addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
      projectItem {
        id
      }
    }
  }
`;

export const REMOVE_ITEM_FROM_PROJECT = `
  mutation RemoveItemFromProject($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      deletedItemId
    }
  }
`;

export const ARCHIVE_ITEM = `
  mutation ArchiveItem($projectId: ID!, $itemId: ID!) {
    archiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item { id }
    }
  }
`;

export const UNARCHIVE_ITEM = `
  mutation UnarchiveItem($projectId: ID!, $itemId: ID!) {
    unarchiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item { id }
    }
  }
`;

export const UPDATE_ITEM_FIELD_VALUE = `
  mutation UpdateItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
      projectV2Item { id }
    }
  }
`;

export const CREATE_FIELD = `
  mutation CreateField($projectId: ID!, $dataType: ProjectV2CustomFieldType!, $name: String!, $singleSelectOptions: [ProjectV2SingleSelectFieldOptionInput!]) {
    createProjectV2Field(input: { projectId: $projectId, dataType: $dataType, name: $name, singleSelectOptions: $singleSelectOptions }) {
      projectV2Field {
        ... on ProjectV2Field { id name dataType }
        ... on ProjectV2SingleSelectField { id name dataType options { id name } }
      }
    }
  }
`;

export const DELETE_FIELD = `
  mutation DeleteField($fieldId: ID!) {
    deleteProjectV2Field(input: { fieldId: $fieldId }) {
      projectV2Field {
        ... on ProjectV2Field { id }
      }
    }
  }
`;

export const UPDATE_PROJECT_WORKFLOW = `
  mutation UpdateWorkflow($workflowId: ID!, $enabled: Boolean!) {
    updateProjectV2Workflow(input: { workflowId: $workflowId, enabled: $enabled }) {
      workflow { id enabled }
    }
  }
`;
