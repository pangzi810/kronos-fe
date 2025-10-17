<template>
  <v-container fluid>
    <!-- Loading indicator -->
    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />
    
    <!-- Page header -->
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold">レスポンステンプレート管理</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          JIRA同期用のVelocityテンプレートを管理します
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        data-testid="create-template-btn"
        @click="createTemplate"
      >
        新しいテンプレート
      </v-btn>
    </div>
    
    <!-- No data alert -->
    <v-alert
      v-if="!loading && !templates.length"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <v-icon start>mdi-information-outline</v-icon>
      テンプレートが登録されていません
    </v-alert>
    
    <!-- Data table -->
    <v-card v-else-if="!loading">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          テンプレート一覧
          <v-chip
            color="primary"
            size="small"
            class="ml-2"
          >
            {{ templates.length }}件
          </v-chip>
        </div>
        <div class="d-flex gap-2">
          <!-- Search -->
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            placeholder="テンプレートを検索..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="width: 300px"
          />
        </div>
      </v-card-title>
      
      <v-divider />
      
      <!-- Data table body -->
      <v-data-table
        :headers="headers"
        :items="filteredTemplates"
        :items-per-page="10"
        hover
        class="elevation-0"
        item-key="id"
        @click:row="handleRowClick"
      >
        <!-- Template name column -->
        <template #item.templateName="{ item }">
          <div class="d-flex align-center">
            <v-icon size="small" class="mr-2">mdi-file-document-outline</v-icon>
            <div>
              <div class="font-weight-medium">{{ item.templateName }}</div>
              <div v-if="item.templateDescription" class="text-caption text-medium-emphasis">
                {{ truncateDescription(item.templateDescription) }}
              </div>
            </div>
          </div>
        </template>
        
        
        
        <!-- Created info column -->
        <template #item.createdInfo="{ item }">
          <div class="text-caption">
            <div>{{ formatDate(item.createdAt) }}</div>
          </div>
        </template>
        
        <!-- Actions column -->
        <template #item.actions="{ item }">
          <div class="d-flex gap-1">
            <v-tooltip text="編集" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click.stop="editTemplate(item)"
                />
              </template>
            </v-tooltip>
            
            <v-tooltip text="テスト" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-play-circle-outline"
                  size="small"
                  variant="text"
                  color="info"
                  @click.stop="testTemplate(item)"
                />
              </template>
            </v-tooltip>
            
            <v-tooltip text="複製" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-content-copy"
                  size="small"
                  variant="text"
                  color="secondary"
                  @click.stop="duplicateTemplate(item)"
                />
              </template>
            </v-tooltip>
            
            <v-tooltip text="削除" location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="deleteTemplate(item)"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>
    </v-card>
    
    <!-- Template editor dialog -->
    <ResponseTemplateEditor
      v-model="showEditorDialog"
      :template="selectedTemplate"
      :mode="editorMode"
      @saved="handleTemplateSaved"
    />
    
    <!-- Delete confirmation dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert</v-icon>
          テンプレートの削除
        </v-card-title>
        
        <v-card-text>
          <p>以下のテンプレートを削除してもよろしいですか？</p>
          <v-alert 
            type="warning" 
            variant="tonal" 
            class="mt-3"
          >
            <strong>{{ templateToDelete?.templateName }}</strong>
            <br>
            この操作は取り消すことができません。
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false">
            キャンセル
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDelete"
          >
            削除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useResponseTemplateManager } from '@/composables/useResponseTemplateManager'
import ResponseTemplateEditor from './ResponseTemplateEditor.vue'

// Use the composable
const {
  // State
  templates,
  loading,
  deleting,
  searchQuery,
  showEditorDialog,
  showDeleteDialog,
  selectedTemplate,
  templateToDelete,
  editorMode,

  // Computed
  filteredTemplates,
  headers,

  // Actions
  createTemplate,
  editTemplate,
  testTemplate,
  duplicateTemplate,
  deleteTemplate,
  confirmDelete,
  handleTemplateSaved,
  handleRowClick,

  // Utilities
  truncateDescription,
  formatDate
} = useResponseTemplateManager()

</script>

<style scoped>
.v-data-table {
  font-size: 0.875rem;
}
</style>