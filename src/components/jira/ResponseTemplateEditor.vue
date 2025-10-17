<template>
  <v-dialog
    :model-value="modelValue"
    persistent
    fullscreen
    transition="dialog-bottom-transition"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <!-- Header -->
      <v-toolbar
        color="primary"
        dark
        density="compact"
      >
        <v-btn
          icon="mdi-close"
          @click="handleCancel"
        />
        
        <v-toolbar-title>
          <v-icon class="mr-2">mdi-file-document-edit-outline</v-icon>
          {{ getDialogTitle(props.mode) }}
        </v-toolbar-title>
        
        <v-spacer />
        
        <div class="d-flex align-center gap-2">
          <!-- Test template button -->
          <v-btn
            variant="text"
            prepend-icon="mdi-play-circle-outline"
            :loading="testing"
            :disabled="!canTest"
            @click="handleTestTemplate"
          >
            テスト実行
          </v-btn>
          
          <!-- Save button -->
          <v-btn
            variant="text"
            prepend-icon="mdi-content-save"
            :loading="saving"
            :disabled="!canSave"
            @click="handleSave"
          >
            保存
          </v-btn>
        </div>
      </v-toolbar>
      
      <!-- Content -->
      <v-container fluid class="pa-6">
        <v-row>
          <!-- Left panel: Editor form -->
          <v-col cols="12" lg="6">
            <v-card class="h-100">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-form-select</v-icon>
                テンプレート設定
              </v-card-title>
              
              <v-divider />
              
              <v-card-text class="pa-4">
                <v-form ref="formRef" v-model="formValid">
                  <!-- Template name -->
                  <v-text-field
                    v-model="formData.templateName"
                    label="テンプレート名"
                    variant="outlined"
                    :rules="templateNameRules"
                    density="compact"
                    class="mb-4"
                    required
                  />
                  
                  <!-- Template description -->
                  <v-textarea
                    v-model="formData.templateDescription"
                    label="説明"
                    variant="outlined"
                    rows="3"
                    density="compact"
                    class="mb-4"
                  />
                  
                  
                  <!-- Template content -->
                  <div class="mb-4">
                    <v-label class="text-body-2 font-weight-medium mb-2">
                      Velocityテンプレート
                      <span class="text-error">*</span>
                    </v-label>
                    
                    <!-- Template content editor -->
                    <v-textarea
                      v-model="formData.velocityTemplate"
                      variant="outlined"
                      rows="15"
                      :rules="velocityTemplateRules"
                      class="template-editor"
                      placeholder="Velocityテンプレートを入力してください..."
                      @input="handleTemplateContentChange"
                    />
                    
                    <!-- Validation feedback -->
                    <div v-if="validationResult" class="mt-2">
                      <v-alert
                        v-if="!validationResult.valid"
                        type="error"
                        variant="tonal"
                        density="compact"
                      >
                        <div class="text-body-2 font-weight-medium mb-1">テンプレートエラー:</div>
                        <ul class="ml-4">
                          <li v-for="error in validationResult.errors" :key="error">
                            {{ error }}
                          </li>
                        </ul>
                      </v-alert>
                      
                      <v-alert
                        v-else
                        type="success"
                        variant="tonal"
                        density="compact"
                      >
                        テンプレートは有効です
                      </v-alert>
                      
                      <!-- Warnings -->
                      <v-alert
                        v-if="validationResult.warnings?.length"
                        type="warning"
                        variant="tonal"
                        density="compact"
                        class="mt-2"
                      >
                        <div class="text-body-2 font-weight-medium mb-1">警告:</div>
                        <ul class="ml-4">
                          <li v-for="warning in validationResult.warnings" :key="warning">
                            {{ warning }}
                          </li>
                        </ul>
                      </v-alert>
                    </div>
                  </div>
                </v-form>
                
                <!-- Template reference guide -->
                <v-expansion-panels class="mt-4">
                  <v-expansion-panel>
                    <v-expansion-panel-title>
                      <v-icon class="mr-2">mdi-help-circle-outline</v-icon>
                      Velocityテンプレート参考
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <div class="template-reference">
                        <h4 class="text-subtitle-2 mb-2">使用可能な変数:</h4>
                        <v-chip-group column>
                          <v-chip
                            v-for="variable in templateVariables"
                            :key="variable.name"
                            size="small"
                            variant="outlined"
                            @click="insertVariable(variable.name)"
                          >
                            {{ variable.name }}
                          </v-chip>
                        </v-chip-group>
                        
                        <h4 class="text-subtitle-2 mb-2 mt-4">基本構文例:</h4>
                        <pre class="template-examples">{{ templateExamples }}</pre>
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Right panel: Test area -->
          <v-col cols="12" lg="6">
            <v-card class="h-100">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-test-tube</v-icon>
                テンプレートテスト
              </v-card-title>
              
              <v-divider />
              
              <v-card-text class="pa-4">
                <!-- Test data input -->
                <div class="mb-4">
                  <v-label class="text-body-2 font-weight-medium mb-2">
                    テストデータ (JSON)
                  </v-label>
                  
                  <v-textarea
                    v-model="testData"
                    variant="outlined"
                    rows="8"
                    placeholder='{"project": {"key": "TEST", "name": "テストプロジェクト"}}'
                    class="test-data-editor"
                  />
                  
                  <!-- Sample data buttons -->
                  <div class="d-flex gap-2 mt-2">
                    <v-btn
                      size="small"
                      variant="outlined"
                      @click="loadSampleData('basic')"
                    >
                      サンプル
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="outlined"
                      @click="clearTestData"
                    >
                      クリア
                    </v-btn>
                  </div>
                </div>
                
                <!-- Test output -->
                <div>
                  <v-label class="text-body-2 font-weight-medium mb-2">
                    テスト結果
                  </v-label>
                  
                  <v-card
                    variant="outlined"
                    class="test-output"
                  >
                    <v-card-text class="pa-3">
                      <div v-if="testResult">
                        <!-- Test success -->
                        <div v-if="testResult.success" class="test-success">
                          <v-icon color="success" size="small" class="mr-2">
                            mdi-check-circle
                          </v-icon>
                          <span class="text-success font-weight-medium">テスト成功</span>
                          
                          <v-divider class="my-3" />
                          
                          <div class="text-body-2 mb-2 font-weight-medium">出力:</div>
                          <pre class="test-output-content">{{ testResult.result }}</pre>
                        </div>
                        
                        <!-- Test failure -->
                        <div v-else class="test-failure">
                          <v-icon color="error" size="small" class="mr-2">
                            mdi-alert-circle
                          </v-icon>
                          <span class="text-error font-weight-medium">テスト失敗</span>
                          
                          <v-divider class="my-3" />
                          
                          <div v-if="testResult.errorMessage">
                            <div class="text-body-2 mb-2 font-weight-medium text-error">エラー:</div>
                            <div class="text-error ml-4">
                              {{ testResult.errorMessage }}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div v-else-if="testing" class="d-flex align-center justify-center py-4">
                        <v-progress-circular indeterminate color="primary" class="mr-2" />
                        テスト実行中...
                      </div>
                      
                      <div v-else class="text-center text-medium-emphasis py-4">
                        テンプレートをテストするには「テスト実行」ボタンをクリックしてください
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useResponseTemplateEditor } from '@/composables/useResponseTemplateEditor'
import type { ResponseTemplate } from '@/services/types/jira.types'

interface Props {
  modelValue: boolean
  template?: ResponseTemplate | null
  mode: 'create' | 'edit' | 'duplicate'
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Use the composable
const {
  // State
  formRef,
  formValid,
  formData,
  saving,
  testing,
  testData,
  testResult,
  validationResult,

  // Reference data
  templateVariables,
  templateExamples,

  // Validation rules
  templateNameRules,
  velocityTemplateRules,

  // Computed
  canSave,
  canTest,

  // Actions
  resetForm,
  saveTemplate,
  testTemplate,
  handleTemplateContentChange,
  insertVariable,
  loadSampleData,
  clearTestData,
  getDialogTitle,
  cleanup
} = useResponseTemplateEditor()

// Watch for template changes
watch(() => props.template, (newTemplate) => {
  if (newTemplate && props.modelValue) {
    resetForm(newTemplate)
  }
}, { immediate: true })

watch(() => props.modelValue, (show) => {
  if (show) {
    if (props.template) {
      resetForm(props.template)
    } else {
      resetForm()
    }
  } else {
    // Clear validation and test results when dialog closes
    validationResult.value = null
    testResult.value = null
  }
})

// Event handlers
const handleCancel = () => {
  emit('update:modelValue', false)
}

const handleSave = async () => {
  const success = await saveTemplate(props.mode, props.template || undefined)
  if (success) {
    emit('saved')
    emit('update:modelValue', false)
  }
}

const handleTestTemplate = async () => {
  await testTemplate(props.mode, props.template || undefined)
}

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.template-editor :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 13px;
  line-height: 1.5;
}

.test-data-editor :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 12px;
}

.template-reference {
  font-size: 14px;
}

.template-examples {
  background-color: rgba(var(--v-theme-surface-variant), 0.4);
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}

.test-output {
  min-height: 200px;
}

.test-output-content {
  background-color: rgba(var(--v-theme-surface-variant), 0.4);
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  margin: 0;
}

.test-success,
.test-failure {
  display: flex;
  align-items: center;
  flex-direction: column;
  align-items: flex-start;
}
</style>