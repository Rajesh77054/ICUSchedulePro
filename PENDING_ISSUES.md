# Pending Issues

## User Preferences
- Fix issue with user preferences ID returning as 0 when updating preferences
  - Current behavior: Server returns ID as 0 despite successful update
  - Expected behavior: Server should return correct ID of updated preferences
  - Affected files: 
    - server/routes.ts
    - client/src/components/scheduler/preferences/PreferencesForm.tsx
  - Priority: High

## Shift Swap Request Visibility
- **Issue**: Shift swap requests are not visible in recipient's Personal Schedule Dashboard
- **Components Affected**: 
  - PersonalDashboard.tsx
  - SwapRequests.tsx
- **Expected Behavior**: When a shift swap is requested, it should appear in both the requestor's and recipient's dashboards
- **Current Behavior**: Request only shows in requestor's dashboard and Shift Swaps page
- **Related Files**:
  - client/src/pages/PersonalDashboard.tsx
  - client/src/components/scheduler/SwapRequests.tsx
  - server/routes.ts