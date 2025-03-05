# Collector Split Tool - Backup & Restore Instructions

## Backup Details
- **Git Tag**: `v1.0.0-stable`
- **Backup Branch**: `backup/v1.0.0-stable`
- **Backup Date**: `2024-08-09`
- **Description**: Stable version before implementing OBJKT API features
- **Current State**: Fully functional collector split tool with 0.1% minimum share adjustment for OBJKT compliance

## How to Restore from Backup

### Option 1: Using the Git Tag (Recommended)
1. To view available backup tags:
   ```
   git tag -l
   ```

2. To revert to the stable version:
   ```
   git checkout v1.0.0-stable
   git checkout -b restored-stable-version
   ```

3. This creates a new branch based on the backup tag, allowing you to continue development from that point.

### Option 2: Using the Backup Branch
1. To switch to the backup branch:
   ```
   git checkout backup/v1.0.0-stable
   ```

2. To create a new working branch from the backup:
   ```
   git checkout -b new-feature-branch
   ```

### Option 3: Reset Current Branch to Backup State
If you want to reset your current branch to the backup state:
```
git reset --hard v1.0.0-stable
```
⚠️ **Warning**: This will discard all changes made after the backup point.

### Option 4: Cherry-pick Specific Commits
If you only want to revert specific changes:
1. Identify the commits you want to revert with:
   ```
   git log
   ```
2. Cherry-pick individual commits:
   ```
   git cherry-pick [commit-hash]
   ```

## Backup Contents

This backup preserves:
- All frontend components including the SplitConfiguration module
- Backend API integrations
- Configuration files and dependencies
- OBJKT-compliant share distribution logic (0.1% minimum threshold)
- UI components for managing collector shares

## What Was Working at Backup Time

- Adjusting shares to ensure all collectors have at least 0.1% (OBJKT's minimum)
- Removing collectors with shares below 0.1%
- Redistributing shares proportionally based on collector ranking
- Visual indicators for share distribution status
- Input validation for share percentages

## Notes for Future Development

When implementing new features after restoration:
1. Create new branches from the backup for each feature
2. Test thoroughly before merging back to main
3. Consider creating additional backup tags before major changes 