# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [3.0.0](https://github.com/gultyayev/angular-vdnd/compare/v2.0.0...v3.0.0) (2026-02-20)

### ⚠ BREAKING CHANGES

- **lib:** dragMove, dragReadyChange, dragEnter, dragLeave,
  dragOver, visibleRangeChange, and scrollPositionChange outputs have
  been removed along with their associated event types. Use
  DragStateService signals for equivalent reactive state, and the
  vdnd-drag-pending CSS class instead of dragReadyChange.

### Features

- **lib:** remove 7 unused outputs from public API ([ff680d8](https://github.com/gultyayev/angular-vdnd/commit/ff680d82183e4e95e6b3f61cc3940d8c7962eca8))

### Bug Fixes

- **lib:** clamp constrainToContainer to scroll viewport and fix flaky E2E reorder ([2ac1bd6](https://github.com/gultyayev/angular-vdnd/commit/2ac1bd673f10435b05b7613883b87e2317d89412))

## [2.0.0](https://github.com/gultyayev/angular-vdnd/compare/v2.0.0-alpha.1...v2.0.0) (2026-02-17)

## [2.0.0-alpha.1](https://github.com/gultyayev/angular-vdnd/compare/v2.0.0-alpha.0...v2.0.0-alpha.1) (2026-02-14)

### Performance

- **lib:** split high-frequency signals from monolithic drag state ([18d642f](https://github.com/gultyayev/angular-vdnd/commit/18d642f880461f4c59d5252ab1eee1b8c0bbc506))

## [2.0.0-alpha.0](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.6...v2.0.0-alpha.0) (2026-02-13)

### ⚠ BREAKING CHANGES

- **lib:** VirtualContentComponent template restructured — virtual
  area is now wrapped in a `.vdnd-virtual-area` div. Consumers using
  `contentOffset` are unaffected (it remains as an escape hatch).
- **lib:** `totalItems` input removed from `VirtualViewportComponent`
  and `VirtualContentComponent`. The total item count is now derived
  automatically from the child `VirtualForDirective` via the shared strategy.

DX improvements:

- `*vdndVirtualFor` inherits `itemHeight`, `dynamicItemHeight`, and
  `droppableId` from parent viewport/droppable when inside one — only
  `trackBy` remains required on the directive
- `VirtualSortableListComponent.group` is now optional — inherits from
  parent `vdndGroup` directive
- `FixedHeightStrategy.setItemKeys()` now bumps `version` on count change,
  enabling strategy-derived total height
- `VirtualScrollStrategy.getItemCount()` is now a required interface method

Migration: Remove `[totalItems]` bindings from `vdnd-virtual-viewport` and
`vdnd-virtual-content`. Remove redundant `itemHeight`, `dynamicItemHeight`,
and `droppableId` from `*vdndVirtualFor` when inside a viewport component.

### Features

- **lib:** auto-measure projected header height via ContentHeaderDirective ([b94b634](https://github.com/gultyayev/angular-vdnd/commit/b94b6345f2d0f8e2da861ed72d9e7cc6e40ac73f))
- **lib:** eliminate data duplication in Pattern B consumer API ([2745934](https://github.com/gultyayev/angular-vdnd/commit/2745934ea1280f17ca7c01c622ec7409a5f789e0))

### Bug Fixes

- **lib:** unify constrained mode probe logic with capped center ([9e20230](https://github.com/gultyayev/angular-vdnd/commit/9e20230df4d1870787660579f123c0bfb6432eb5))

## [1.3.0-alpha.6](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.5...v1.3.0-alpha.6) (2026-02-13)

### Bug Fixes

- **lib:** dynamic height drift cases ([916d97e](https://github.com/gultyayev/angular-vdnd/commit/916d97eded0261ccb135daafc3b4d0b0b56cc29b))

## [1.3.0-alpha.5](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.4...v1.3.0-alpha.5) (2026-02-13)

### Bug Fixes

- **lib:** harden dynamic height strategy performance and correctness ([9caac28](https://github.com/gultyayev/angular-vdnd/commit/9caac28ecd32fe8c9d41d4cd3098bd1a59a29a08))
- **lib:** use direction-aware probing for dynamic drag index ([b6346d1](https://github.com/gultyayev/angular-vdnd/commit/b6346d1113b733dc6fd94f5cfa8e5dbf7b13152b))

## [1.3.0-alpha.4](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.3...v1.3.0-alpha.4) (2026-02-13)

### Bug Fixes

- **lib:** allow constrained dynamic drag to reach list edges ([38519b2](https://github.com/gultyayev/angular-vdnd/commit/38519b27648d1d8c8de6d0f50f2af55b5dea5da4))

## [1.3.0-alpha.3](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.2...v1.3.0-alpha.3) (2026-02-13)

### Features

- **lib:** warn of trackBy duplicates ([087f77d](https://github.com/gultyayev/angular-vdnd/commit/087f77de697854e0f7cd96431c65a4bb491f4a27))

## [1.3.0-alpha.2](https://github.com/gultyayev/angular-vdnd/compare/v1.2.3...v1.3.0-alpha.2) (2026-02-13)

### Features

- **lib:** add dynamic item height support for virtual scroll ([#15](https://github.com/gultyayev/angular-vdnd/issues/15)) ([a7479e3](https://github.com/gultyayev/angular-vdnd/commit/a7479e38671b8269b897fa56f781a7182609e150))
- **lib:** constrain drag by container ([#16](https://github.com/gultyayev/angular-vdnd/issues/16)) ([2fe954f](https://github.com/gultyayev/angular-vdnd/commit/2fe954f4b2cc3f92929bad01df679b7692243197))

### Bug Fixes

- **lib:** don't print warnings in prod mode ([d987c96](https://github.com/gultyayev/angular-vdnd/commit/d987c96bbd98c8ae0a5d94c9668d02a6e06f7792))
- **lib:** stabilize same-list dynamic placeholder index before exclusion sync ([fe6063d](https://github.com/gultyayev/angular-vdnd/commit/fe6063dc77cdc8db02e5ca814d78daf23fe4854c))

## [1.3.0-alpha.1](https://github.com/gultyayev/angular-vdnd/compare/v1.3.0-alpha.0...v1.3.0-alpha.1) (2026-02-12)

### Bug Fixes

- fix e2e ([0d9e468](https://github.com/gultyayev/angular-vdnd/commit/0d9e4684d31c27cc8daaf8f70999c8750c9ddea6))
- fix gaps ([2b352ec](https://github.com/gultyayev/angular-vdnd/commit/2b352ec982e8e9f1c8c1de08c35b393b87c8b518))
- fix height shrinkage ([d9030e5](https://github.com/gultyayev/angular-vdnd/commit/d9030e5a7fd5707f9db8a3ade90aa6293c8f9b68))

## [1.3.0-alpha.0](https://github.com/gultyayev/angular-vdnd/compare/v1.2.3...v1.3.0-alpha.0) (2026-02-11)

### Features

- **lib:** add dynamic item height support for virtual scroll ([5678c3c](https://github.com/gultyayev/angular-vdnd/commit/5678c3c3fa60b5202c77a2c1c3f8b0c08528b7ae))

### Bug Fixes

- **lib:** don't print warnings in prod mode ([d987c96](https://github.com/gultyayev/angular-vdnd/commit/d987c96bbd98c8ae0a5d94c9668d02a6e06f7792))
- **lib:** fix scroll with drag in dynamic height ([871f9b4](https://github.com/gultyayev/angular-vdnd/commit/871f9b4e99bfd7b1c40264506e38eb9517cbcfb2))

## [1.2.3](https://github.com/gultyayev/angular-vdnd/compare/v1.2.2...v1.2.3) (2026-02-06)

### Bug Fixes

- **lib:** teleport drag preview to body overlay to fix CSS transform offset ([979c443](https://github.com/gultyayev/angular-vdnd/commit/979c44372b1b6e4c93c48567ac06515b2a01409f))

## [1.2.2](https://github.com/gultyayev/angular-vdnd/compare/v1.2.1...v1.2.2) (2026-01-24)

### Performance

- **lib:** reduce drag jank and dedupe scroll bindings ([#9](https://github.com/gultyayev/angular-vdnd/issues/9)) ([52b0177](https://github.com/gultyayev/angular-vdnd/commit/52b01773113ed05db9dfc1820f2882454c7467f6))

## [1.2.1](https://github.com/gultyayev/angular-vdnd/compare/v1.2.0...v1.2.1) (2026-01-23)

### Bug Fixes

- **lib:** prevent axis-lock offset at drag start ([#7](https://github.com/gultyayev/angular-vdnd/issues/7)) ([3cf1611](https://github.com/gultyayev/angular-vdnd/commit/3cf161114912676b45414f197bc15a4c7de1e756))

### Performance

- **lib:** use transform-based positioning for drag preview ([#5](https://github.com/gultyayev/angular-vdnd/issues/5)) ([fcd8c75](https://github.com/gultyayev/angular-vdnd/commit/fcd8c758ad920a0a4e1a19acd27a90797c906d29))

## [1.2.0](https://github.com/gultyayev/angular-vdnd/compare/v1.1.2...v1.2.0) (2026-01-23)

### Features

- **demo:** add page-level scroll demo with Ionic ([#4](https://github.com/gultyayev/angular-vdnd/issues/4)) ([d1c7fb1](https://github.com/gultyayev/angular-vdnd/commit/d1c7fb18c5b6b5903b929b13e533452198d36af8))

## [1.1.2](https://github.com/gultyayev/angular-vdnd/compare/v1.1.1...v1.1.2) (2026-01-14)

### Performance

- **lib:** optimize change detection and reduce allocations during drag ([1b8a579](https://github.com/gultyayev/angular-vdnd/commit/1b8a5791aa36010c95a11fc72dcf4aed03e987d2))

## [1.1.1](https://github.com/gultyayev/angular-vdnd/compare/v1.1.0...v1.1.1) (2026-01-08)

## [1.1.0](https://github.com/gultyayev/angular-vdnd/compare/v1.0.0...v1.1.0) (2026-01-08)

### Features

- **lib:** add a11y support ([3ebccec](https://github.com/gultyayev/angular-vdnd/commit/3ebccec10d447e9840168d0a1e97a5a5039188ed))
