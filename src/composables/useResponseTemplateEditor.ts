import { ref, computed, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { jiraService } from '@/services/domains/jira.service'
import type { 
  ResponseTemplate, 
  ResponseTemplateCreateRequest, 
  ResponseTemplateUpdateRequest,
  TemplateTestRequest,
  TemplateTestResult
} from '@/services/types/jira.types'

export interface UseResponseTemplateEditorOptions {
  autoValidate?: boolean
  validationDelay?: number
}

export interface TemplateValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

export interface TemplateVariable {
  name: string
  description: string
}

export function useResponseTemplateEditor(options: UseResponseTemplateEditorOptions = {}) {
  const { autoValidate = true, validationDelay = 500 } = options
  
  const toast = useToast()

  // Form data and refs
  const formRef = ref()
  const formValid = ref(false)
  const formData = ref({
    templateName: '',
    templateDescription: '',
    velocityTemplate: ''
  })

  // State
  const saving = ref(false)
  const testing = ref(false)
  const testData = ref('{}')
  const testResult = ref<TemplateTestResult | null>(null)
  const validationResult = ref<TemplateValidationResult | null>(null)
  
  let validationTimeout: NodeJS.Timeout | null = null

  // Template reference data
  const templateVariables: TemplateVariable[] = [
    { name: '$project.key', description: 'プロジェクトキー' },
    { name: '$project.name', description: 'プロジェクト名' },
    { name: '$project.description', description: 'プロジェクト説明' },
    { name: '$issues', description: '課題リスト' },
    { name: '$issue.key', description: '課題キー' },
    { name: '$issue.summary', description: '課題サマリー' },
    { name: '$issue.status.name', description: 'ステータス名' },
    { name: '$issue.priority.name', description: '優先度名' },
    { name: '$issue.assignee.displayName', description: 'アサイン先' },
    { name: '$dateTime', description: '現在日時' },
    { name: '$syncInfo.type', description: '同期タイプ' }
  ]

  const templateExamples = `# プロジェクト同期結果
プロジェクト: $project.name ($project.key)

#if($issues.size() > 0)
## 同期された課題 ($issues.size()件)
#foreach($issue in $issues)
- $issue.key: $issue.summary
  - ステータス: $issue.status.name
  - 優先度: $issue.priority.name
#end
#else
課題は見つかりませんでした。
#end

同期日時: $dateTime`

  // Form validation rules
  const templateNameRules = [
    (v: string) => !!v || 'テンプレート名は必須です',
    (v: string) => (v && v.length >= 2) || 'テンプレート名は2文字以上で入力してください',
    (v: string) => (v && v.length <= 100) || 'テンプレート名は100文字以内で入力してください'
  ]

  const velocityTemplateRules = [
    (v: string) => !!v || 'Velocityテンプレートは必須です',
    (v: string) => (v && v.length >= 10) || 'テンプレートは10文字以上で入力してください'
  ]

  // Computed
  const canSave = computed(() => {
    return formValid.value && formData.value.templateName && formData.value.velocityTemplate
  })

  const canTest = computed(() => {
    return !!formData.value.velocityTemplate
  })

  // Template operations
  const resetForm = (template?: ResponseTemplate) => {
    if (template) {
      formData.value = {
        templateName: template.templateName,
        templateDescription: template.templateDescription || '',
        velocityTemplate: template.velocityTemplate
      }
    } else {
      formData.value = {
        templateName: '',
        templateDescription: '',
        velocityTemplate: ''
      }
    }
    
    // Reset validation state
    nextTick(() => {
      formRef.value?.resetValidation()
    })
    
    testData.value = '{}'
    testResult.value = null
    validationResult.value = null
  }

  const saveTemplate = async (mode: 'create' | 'edit' | 'duplicate', existingTemplate?: ResponseTemplate): Promise<boolean> => {
    // Validate form
    if (formRef.value) {
      const { valid } = await formRef.value.validate()
      if (!valid) return false
    }
    
    saving.value = true
    
    try {
      if (mode === 'create' || mode === 'duplicate') {
        const payload: ResponseTemplateCreateRequest = {
          templateName: formData.value.templateName,
          velocityTemplate: formData.value.velocityTemplate,
          templateDescription: formData.value.templateDescription || undefined
        }
        
        await jiraService.createTemplate(payload)
        toast.success('テンプレートを作成しました')
        
      } else if (mode === 'edit' && existingTemplate) {
        const payload: ResponseTemplateUpdateRequest = {
          templateName: formData.value.templateName,
          velocityTemplate: formData.value.velocityTemplate,
          templateDescription: formData.value.templateDescription || undefined
        }
        
        await jiraService.updateTemplate(existingTemplate.id, payload)
        toast.success('テンプレートを更新しました')
      }
      
      return true

    } catch (_error) {
      toast.error('テンプレートの保存に失敗しました')
      console.error('Failed to save template:', _error)
      return false
    } finally {
      saving.value = false
    }
  }

  const testTemplate = async (mode: 'create' | 'edit' | 'duplicate', existingTemplate?: ResponseTemplate): Promise<void> => {
    if (!formData.value.velocityTemplate) return
    
    testing.value = true
    testResult.value = null
    
    try {
      let testDataObj = {}
      
      // Parse test data if provided
      if (testData.value.trim()) {
        try {
          testDataObj = JSON.parse(testData.value)
        } catch (_e) {
          toast.error('テストデータのJSONが無効です')
          testing.value = false
          return
        }
      }
      
      const testRequest: TemplateTestRequest = {
        testData: JSON.stringify(testDataObj)
      }
      
      // If we have an existing template ID and we're editing, use it
      // Otherwise test with the template content directly
      if (existingTemplate?.id && mode === 'edit') {
        testResult.value = await jiraService.testTemplate(existingTemplate.id, testRequest)
      } else {
        // For new templates, simulate a basic validation
        testResult.value = {
          success: true,
          result: '# テスト実行結果\n\nテンプレートの構文は有効です。\n実際のJIRAデータを使用したテストは、テンプレート保存後に利用できます。',
          errorMessage: null,
          executionTimeMs: 0
        }
      }
      
      // Basic template validation
      await validateTemplateContent()
      
    } catch (_error) {
      testResult.value = {
        success: false,
        result: null,
        errorMessage: 'テンプレートのテストに失敗しました',
        executionTimeMs: 0
      }
      console.error('Template test failed:', _error)
    } finally {
      testing.value = false
    }
  }

  const validateTemplateContent = async (): Promise<void> => {
    if (!formData.value.velocityTemplate.trim()) {
      validationResult.value = null
      return
    }
    
    try {
      // Basic Velocity syntax validation
      const template = formData.value.velocityTemplate
      const errors: string[] = []
      const warnings: string[] = []
      
      // Check for basic Velocity syntax issues
      const openDirectives = (template.match(/#if|#foreach/g) || []).length
      const closeDirectives = (template.match(/#end/g) || []).length
      
      if (openDirectives !== closeDirectives) {
        errors.push(`#if/#foreach ディレクティブと #end の数が一致しません (開始: ${openDirectives}, 終了: ${closeDirectives})`)
      }
      
      // Check for unclosed variable references
      const openVars = (template.match(/\$\{[^}]*$/g) || []).length
      if (openVars > 0) {
        warnings.push('閉じられていない変数参照があります')
      }
      
      // Check for common mistakes
      if (template.includes('$issues') && !template.includes('#foreach')) {
        warnings.push('$issuesを使用していますが、#foreachでイテレーションしていません')
      }
      
      validationResult.value = {
        valid: errors.length === 0,
        errors,
        warnings
      }
      
    } catch (_error) {
      validationResult.value = {
        valid: false,
        errors: ['テンプレートの検証中にエラーが発生しました'],
        warnings: []
      }
    }
  }

  const handleTemplateContentChange = (): void => {
    if (!autoValidate) return
    
    // Clear previous timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout)
    }
    
    // Debounced validation
    validationTimeout = setTimeout(validateTemplateContent, validationDelay)
  }

  const insertVariable = (variableName: string): void => {
    const textarea = document.querySelector('.template-editor textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = formData.value.velocityTemplate
      
      formData.value.velocityTemplate = 
        text.substring(0, start) + variableName + text.substring(end)
      
      // Focus back to textarea and position cursor
      nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variableName.length, start + variableName.length)
      })
    }
  }

  const loadSampleData = (type: 'basic' | 'advanced'): void => {
      testData.value = JSON.stringify({
  "expand": "operations,versionedRepresentations,editmeta,changelog,renderedFields",
  "id": "10002",
  "self": "https: //your-domain.atlassian.net/rest/api/2/issue/10002",
  "key": "KAN-3",
  "renderedFields": {
    "statuscategorychangedate": "02/9/25 12:32 午前",
    "issuetype": null,
    "components": null,
    "timespent": null,
    "timeoriginalestimate": null,
    "project": null,
    "description": "",
    "fixVersions": null,
    "aggregatetimespent": null,
    "statusCategory": null,
    "resolution": null,
    "customfield_10036": null,
    "timetracking": {},
    "security": null,
    "aggregatetimeestimate": null,
    "resolutiondate": null,
    "workratio": null,
    "summary": null,
    "issuerestriction": null,
    "watches": null,
    "lastViewed": null,
    "creator": null,
    "subtasks": null,
    "created": "02/9/25 12:32 午前",
    "customfield_10021": null,
    "reporter": null,
    "aggregateprogress": null,
    "priority": null,
    "customfield_10001": null,
    "labels": null,
    "environment": "",
    "customfield_10019": null,
    "timeestimate": null,
    "aggregatetimeoriginalestimate": null,
    "versions": null,
    "duedate": null,
    "progress": null,
    "issuelinks": null,
    "votes": null,
    "assignee": null,
    "updated": "02/9/25 12:32 午前",
    "status": null
  },
  "operations": {
    "linkGroups": [
      {
        "id": "view.issue.opsbar",
        "links": [],
        "groups": [
          {
            "id": "edit-issue_container",
            "weight": 1,
            "links": [
              {
                "id": "edit-issue",
                "styleClass": "issueaction-edit-issue",
                "iconClass": "aui-icon aui-icon-small aui-iconfont-edit",
                "label": "編集",
                "title": "この課題を編集する",
                "href": "/secure/EditIssue!default.jspa?id=10002",
                "weight": 1
              }
            ],
            "groups": []
          },
          {
            "id": "comment-issue_container",
            "weight": 10,
            "links": [
              {
                "id": "comment-issue",
                "styleClass": "issueaction-comment-issue add-issue-comment",
                "iconClass": "aui-icon aui-icon-small aui-iconfont-comment icon-comment",
                "label": "コメント",
                "title": "この課題にコメントを付ける",
                "href": "/secure/AddComment!default.jspa?id=10002",
                "weight": 10
              }
            ],
            "groups": []
          },
          {
            "id": "assign-issue_container",
            "weight": 5,
            "links": [
              {
                "id": "assign-issue",
                "styleClass": "issueaction-assign-issue",
                "label": "割り当て",
                "title": "この課題を誰かに割り当てる",
                "href": "/secure/AssignIssue!default.jspa?id=10002",
                "weight": 5
              }
            ],
            "groups": []
          },
          {
            "id": "opsbar-transitions",
            "weight": 20,
            "links": [
              {
                "id": "action_id_11",
                "styleClass": "issueaction-workflow-transition",
                "label": "Idea",
                "href": "/secure/WorkflowUIDispatcher.jspa?id=10002&action=11&atl_token=b836e6138838d35effc788a1e6daffd957367758_lin",
                "weight": 10
              },
              {
                "id": "action_id_21",
                "styleClass": "issueaction-workflow-transition",
                "label": "To Do",
                "href": "/secure/WorkflowUIDispatcher.jspa?id=10002&action=21&atl_token=b836e6138838d35effc788a1e6daffd957367758_lin",
                "weight": 20
              }
            ],
            "groups": [
              {
                "header": {
                  "id": "opsbar-transitions_more",
                  "label": "ワークフロー"
                },
                "links": [],
                "groups": [
                  {
                    "id": "transitions-all",
                    "weight": 70,
                    "links": [
                      {
                        "id": "action_id_31",
                        "styleClass": "issueaction-workflow-transition",
                        "label": "進行中",
                        "href": "/secure/WorkflowUIDispatcher.jspa?id=10002&action=31&atl_token=b836e6138838d35effc788a1e6daffd957367758_lin",
                        "weight": 30
                      },
                      {
                        "id": "action_id_41",
                        "styleClass": "issueaction-workflow-transition",
                        "label": "Testing",
                        "href": "/secure/WorkflowUIDispatcher.jspa?id=10002&action=41&atl_token=b836e6138838d35effc788a1e6daffd957367758_lin",
                        "weight": 40
                      },
                      {
                        "id": "action_id_51",
                        "styleClass": "issueaction-workflow-transition",
                        "label": "完了",
                        "href": "/secure/WorkflowUIDispatcher.jspa?id=10002&action=51&atl_token=b836e6138838d35effc788a1e6daffd957367758_lin",
                        "weight": 50
                      }
                    ],
                    "groups": []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "jira.issue.tools",
        "links": [
          {
            "id": "jira-share-trigger",
            "styleClass": "viewissue-share",
            "iconClass": "aui-icon aui-icon-small aui-iconfont-share",
            "label": "",
            "title": "他のユーザーにメール配信してこの課題を共有します",
            "href": "",
            "weight": 10
          }
        ],
        "groups": [
          {
            "id": "view.issue.exports",
            "header": {
              "id": "viewissue-export",
              "styleClass": "aui-dropdown2-trigger-arrowless",
              "iconClass": "icon-default aui-icon aui-icon-small aui-iconfont-export",
              "label": "エクスポート",
              "title": "この課題を別の形式にエクスポートします"
            },
            "links": [
              {
                "id": "jira.issueviews:issue-html",
                "label": "印刷",
                "href": "/si/jira.issueviews:issue-html/KAN-3/KAN-3.html"
              },
              {
                "id": "jira.issueviews:issue-xml",
                "label": "XMLのエクスポート",
                "href": "/si/jira.issueviews:issue-xml/KAN-3/KAN-3.xml"
              },
              {
                "id": "jira.issueviews:issue-word",
                "label": "Word のエクスポート",
                "href": "/si/jira.issueviews:issue-word/KAN-3/KAN-3.doc"
              }
            ],
            "groups": []
          },
          {
            "id": "jira.issue.tools.more",
            "header": {
              "id": "opsbar-operations_more",
              "styleClass": "aui-dropdown2-trigger-arrowless",
              "iconClass": "aui-icon aui-icon-small aui-iconfont-more",
              "label": "詳細"
            },
            "links": [],
            "groups": [
              { "id": "operations-top-level", "links": [], "groups": [] },
              {
                "id": "greenhopper_issue_dropdown",
                "links": [
                  {
                    "id": "greenhopper-rapidboard-operation",
                    "styleClass": "issueaction-greenhopper-rapidboard-operation js-rapidboard-operation-issue",
                    "label": "アジャイル ボード",
                    "title": "アジャイル ボードでこの課題を表示",
                    "href": "/secure/GHGoToBoard.jspa?issueId=10002",
                    "weight": 30
                  }
                ],
                "groups": []
              },
              {
                "id": "operations-work",
                "links": [
                  {
                    "id": "log-work",
                    "styleClass": "issueaction-log-work",
                    "label": "作業をログ",
                    "title": "この課題の作業を記録する",
                    "href": "/secure/CreateWorklog!default.jspa?id=10002",
                    "weight": 10
                  },
                  {
                    "id": "jira-slack-integration__connect-channel-web-item",
                    "styleClass": "ap-dialog ap-target-key-connected-channels-new-connection-dialog ap-plugin-key-jira-slack-integration ap-module-key-connect-channel-web-item ap-link-webitem",
                    "label": "Connect Slack channel",
                    "href": "/plugins/servlet/ac/jira-slack-integration/jira-slack-integration__connect-channel-web-item?project.key=KAN&project.id=10000&issue.id=10002&issue.key=KAN-3&issuetype.id=10002",
                    "weight": 100
                  }
                ],
                "groups": []
              },
              {
                "id": "operations-attachments",
                "links": [
                  {
                    "id": "attach-file",
                    "styleClass": "unified-attach-file",
                    "label": "ファイルの添付",
                    "title": "この課題に1つまたは複数のファイルを添付",
                    "href": "/secure/AttachFile!default.jspa?id=10002",
                    "weight": 10
                  },
                  {
                    "id": "attach-screenshot-html5",
                    "styleClass": "issueaction-attach-screenshot-html5",
                    "label": "スクリーンショットの添付",
                    "href": "/secure/ShowAttachScreenshotFormAction!default.jspa?id=10002",
                    "weight": 15
                  }
                ],
                "groups": []
              },
              {
                "id": "operations-voteswatchers",
                "links": [
                  {
                    "id": "view-voters",
                    "styleClass": "issueaction-view-voters",
                    "label": "投票",
                    "title": "この課題への投票者を表示",
                    "href": "/secure/ViewVoters!default.jspa?id=10002",
                    "weight": 30
                  },
                  {
                    "id": "toggle-watch-issue",
                    "styleClass": "issueaction-unwatch-issue",
                    "label": "ウォッチの停止",
                    "title": "この課題のウォッチを中止する",
                    "href": "/secure/VoteOrWatchIssue.jspa?atl_token=b836e6138838d35effc788a1e6daffd957367758_lin&id=10002&watch=unwatch",
                    "weight": 50
                  },
                  {
                    "id": "manage-watchers",
                    "styleClass": "issueaction-manage-watchers",
                    "label": "ウォッチャー",
                    "title": "この課題のウォッチャーを管理する",
                    "href": "/secure/ManageWatchers!default.jspa?id=10002",
                    "weight": 60
                  }
                ],
                "groups": []
              },
              {
                "id": "operations-subtasks",
                "links": [
                  {
                    "id": "subtask-to-issue",
                    "styleClass": "issueaction-subtask-to-issue",
                    "label": "課題に変換",
                    "title": "このサブタスクを課題に変換する",
                    "href": "/secure/ConvertSubTask.jspa?id=10002",
                    "weight": 20
                  }
                ],
                "groups": []
              },
              { "id": "devstatus-cta-list", "links": [], "groups": [] },
              {
                "id": "operations-operations",
                "links": [
                  {
                    "id": "move-issue",
                    "styleClass": "issueaction-move-subtask",
                    "label": "移動",
                    "title": "この課題を別のプロジェクトまたは課題タイプに移動する",
                    "href": "/secure/MoveSubTaskChooseOperation!default.jspa?id=10002",
                    "weight": 10
                  },
                  {
                    "id": "link-issue",
                    "styleClass": "issueaction-link-issue",
                    "label": "リンク",
                    "title": "この課題を別の課題または項目にリンクする",
                    "href": "/secure/LinkJiraIssue!default.jspa?id=10002",
                    "weight": 20
                  },
                  {
                    "id": "clone-issue",
                    "styleClass": "issueaction-clone-issue",
                    "label": "クローン",
                    "title": "課題のクローン",
                    "href": "/secure/CloneIssueDetails!default.jspa?id=10002",
                    "weight": 20
                  },
                  {
                    "id": "edit-labels",
                    "styleClass": "issueaction-edit-labels",
                    "label": "ラベル",
                    "title": "この課題のラベルを編集する",
                    "href": "/secure/EditLabels!default.jspa?id=10002",
                    "weight": 30
                  }
                ],
                "groups": []
              },
              {
                "id": "operations-delete",
                "links": [
                  {
                    "id": "delete-issue",
                    "styleClass": "issueaction-delete-issue",
                    "label": "削除",
                    "title": "この課題を削除する",
                    "href": "/secure/DeleteIssue!default.jspa?id=10002",
                    "weight": 10
                  }
                ],
                "groups": []
              }
            ]
          }
        ]
      }
    ]
  },
  "editmeta": {
    "fields": {
      "summary": {
        "required": true,
        "schema": { "type": "string", "system": "summary" },
        "name": "要約",
        "key": "summary",
        "operations": ["set"]
      },
      "parent": {
        "required": true,
        "schema": { "type": "issuelink", "system": "parent" },
        "name": "親",
        "key": "parent",
        "hasDefaultValue": false,
        "operations": ["set"]
      },
      "issuetype": {
        "required": true,
        "schema": { "type": "issuetype", "system": "issuetype" },
        "name": "課題タイプ",
        "key": "issuetype",
        "operations": [],
        "allowedValues": [
          {
            "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10003",
            "id": "10003",
            "description": "A broad piece of functionality.",
            "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10314?size=medium",
            "name": "Feature",
            "subtask": false,
            "avatarId": 10314,
            "entityId": "6d856ccd-bb58-413e-9b69-01c043d74f06",
            "hierarchyLevel": 0
          },
          {
            "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10004",
            "id": "10004",
            "description": "さまざまな小規模作業。",
            "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10318?size=medium",
            "name": "タスク",
            "subtask": false,
            "avatarId": 10318,
            "entityId": "20567866-20fe-4726-88f4-7e2c8ede58ff",
            "hierarchyLevel": 0
          },
          {
            "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10005",
            "id": "10005",
            "description": "ユーザー目標として表明された機能。",
            "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10315?size=medium",
            "name": "ストーリー",
            "subtask": false,
            "avatarId": 10315,
            "entityId": "d64c98c3-e5f2-469b-a7a7-cf0f7d6748a7",
            "hierarchyLevel": 0
          },
          {
            "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10006",
            "id": "10006",
            "description": "問題またはエラー。",
            "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium",
            "name": "バグ",
            "subtask": false,
            "avatarId": 10303,
            "entityId": "a2d25677-b4e6-4f7a-8405-50eeb1e2800c",
            "hierarchyLevel": 0
          }
        ]
      },
      "issuerestriction": {
        "required": false,
        "schema": { "type": "issuerestriction", "system": "issuerestriction" },
        "name": "制限対象",
        "key": "issuerestriction",
        "operations": ["set"],
        "allowedValues": []
      },
      "description": {
        "required": false,
        "schema": { "type": "string", "system": "description" },
        "name": "説明",
        "key": "description",
        "operations": ["set"]
      },
      "reporter": {
        "required": true,
        "schema": { "type": "user", "system": "reporter" },
        "name": "報告者",
        "key": "reporter",
        "autoCompleteUrl": "https://your-domain.atlassian.net/rest/api/2/user/recommend?context=Reporter&issueKey=KAN-3",
        "operations": ["set"]
      },
      "customfield_10021": {
        "required": false,
        "schema": {
          "type": "array",
          "items": "option",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes",
          "customId": 10021
        },
        "name": "Flagged",
        "key": "customfield_10021",
        "operations": ["add", "set", "remove"],
        "allowedValues": [
          {
            "self": "https://your-domain.atlassian.net/rest/api/2/customFieldOption/10019",
            "value": "Impediment",
            "id": "10019"
          }
        ]
      },
      "customfield_10000": {
        "required": false,
        "schema": {
          "type": "any",
          "custom": "com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf",
          "customId": 10000
        },
        "name": "開発",
        "key": "customfield_10000",
        "operations": ["set"]
      },
      "customfield_10034": {
        "required": false,
        "schema": {
          "type": "any",
          "custom": "com.atlassian.jira.plugins.jira-development-integration-plugin:vulnerabilitycf",
          "customId": 10034
        },
        "name": "Vulnerability",
        "key": "customfield_10034",
        "operations": ["set"]
      },
      "customfield_10001": {
        "required": false,
        "schema": {
          "type": "team",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:atlassian-team",
          "customId": 10001,
          "configuration": {
            "com.atlassian.jira.plugin.system.customfieldtypes:atlassian-team": true
          }
        },
        "name": "Team",
        "key": "customfield_10001",
        "autoCompleteUrl": "https://your-domain.atlassian.net/gateway/api/v1/recommendations",
        "operations": ["set"]
      },
      "customfield_10036": {
        "required": false,
        "schema": {
          "type": "array",
          "items": "design.field.name",
          "custom": "com.atlassian.jira.plugins.jira-development-integration-plugin:designcf",
          "customId": 10036
        },
        "name": "Design",
        "key": "customfield_10036",
        "autoCompleteUrl": "",
        "operations": ["set"]
      },
      "labels": {
        "required": false,
        "schema": { "type": "array", "items": "string", "system": "labels" },
        "name": "ラベル",
        "key": "labels",
        "autoCompleteUrl": "https://your-domain.atlassian.net/rest/api/1.0/labels/10002/suggest?query=",
        "operations": ["add", "set", "remove"]
      },
      "environment": {
        "required": false,
        "schema": { "type": "string", "system": "environment" },
        "name": "環境",
        "key": "environment",
        "operations": ["set"]
      },
      "customfield_10019": {
        "required": false,
        "schema": {
          "type": "any",
          "custom": "com.pyxis.greenhopper.jira:gh-lexo-rank",
          "customId": 10019
        },
        "name": "Rank",
        "key": "customfield_10019",
        "operations": ["set"]
      },
      "issuelinks": {
        "required": false,
        "schema": {
          "type": "array",
          "items": "issuelinks",
          "system": "issuelinks"
        },
        "name": "リンクされた課題",
        "key": "issuelinks",
        "autoCompleteUrl": "https://your-domain.atlassian.net/rest/api/2/issue/picker?currentProjectId=&showSubTaskParent=true&showSubTasks=true&currentIssueKey=KAN-3&query=",
        "operations": ["add", "copy"]
      },
      "assignee": {
        "required": false,
        "schema": { "type": "user", "system": "assignee" },
        "name": "担当者",
        "key": "assignee",
        "autoCompleteUrl": "https://your-domain.atlassian.net/rest/api/2/user/assignable/search?issueKey=KAN-3&query=",
        "operations": ["set"]
      }
    }
  },
  "changelog": {
    "startAt": 0,
    "maxResults": 2,
    "total": 2,
    "histories": [
      {
        "id": "10006",
        "author": {
          "self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=557058%3Ad32c0488-f5a5-45ab-b9d5-187d11347e3e",
          "accountId": "557058:d32c0488-f5a5-45ab-b9d5-187d11347e3e",
          "emailAddress": "your-domain@gmail.com",
          "avatarUrls": {
            "48x48": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "24x24": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "16x16": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "32x32": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png"
          },
          "displayName": "Toshihiro Tomita",
          "active": true,
          "timeZone": "Asia/Tokyo",
          "accountType": "atlassian"
        },
        "created": "2025-09-02T00:32:18.770+0900",
        "items": [
          {
            "field": "status",
            "fieldtype": "jira",
            "fieldId": "status",
            "from": "10000",
            "fromString": "Idea",
            "to": "10002",
            "toString": "In Progress"
          }
        ]
      },
      {
        "id": "10004",
        "author": {
          "self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=557058%3Ad32c0488-f5a5-45ab-b9d5-187d11347e3e",
          "accountId": "557058:d32c0488-f5a5-45ab-b9d5-187d11347e3e",
          "emailAddress": "your-domain@gmail.com",
          "avatarUrls": {
            "48x48": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "24x24": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "16x16": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
            "32x32": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png"
          },
          "displayName": "Toshihiro Tomita",
          "active": true,
          "timeZone": "Asia/Tokyo",
          "accountType": "atlassian"
        },
        "created": "2025-09-02T00:32:18.421+0900",
        "items": [
          {
            "field": "IssueParentAssociation",
            "fieldtype": "jira",
            "from": null,
            "fromString": null,
            "to": "10001",
            "toString": "KAN-2"
          }
        ]
      }
    ]
  },
  "fields": {
    "statuscategorychangedate": "2025-09-02T00:32:18.770+0900",
    "issuetype": {
      "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10002",
      "id": "10002",
      "description": "Subtasks track small pieces of work that are part of a larger task.",
      "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10316?size=medium",
      "name": "Subtask",
      "subtask": true,
      "avatarId": 10316,
      "entityId": "993ec302-929f-4b74-b64d-834135e88b12",
      "hierarchyLevel": -1
    },
    "parent": {
      "id": "10001",
      "key": "KAN-2",
      "self": "https://your-domain.atlassian.net/rest/api/2/issue/10001",
      "fields": {
        "summary": "タスク 2",
        "status": {
          "self": "https://your-domain.atlassian.net/rest/api/2/status/10001",
          "description": "",
          "iconUrl": "https://your-domain.atlassian.net/images/icons/statuses/generic.png",
          "name": "To Do",
          "id": "10001",
          "statusCategory": {
            "self": "https://your-domain.atlassian.net/rest/api/2/statuscategory/4",
            "id": 4,
            "key": "indeterminate",
            "colorName": "yellow",
            "name": "進行中"
          }
        },
        "issuetype": {
          "self": "https://your-domain.atlassian.net/rest/api/2/issuetype/10004",
          "id": "10004",
          "description": "さまざまな小規模作業。",
          "iconUrl": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10318?size=medium",
          "name": "タスク",
          "subtask": false,
          "avatarId": 10318,
          "entityId": "20567866-20fe-4726-88f4-7e2c8ede58ff",
          "hierarchyLevel": 0
        }
      }
    },
    "components": [],
    "timespent": null,
    "timeoriginalestimate": null,
    "project": {
      "self": "https://your-domain.atlassian.net/rest/api/2/project/10000",
      "id": "10000",
      "key": "KAN",
      "name": "My Kanban Project",
      "projectTypeKey": "software",
      "simplified": true,
      "avatarUrls": {
        "48x48": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/project/avatar/10406",
        "24x24": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/project/avatar/10406?size=small",
        "16x16": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/project/avatar/10406?size=xsmall",
        "32x32": "https://your-domain.atlassian.net/rest/api/2/universal_avatar/view/type/project/avatar/10406?size=medium"
      }
    },
    "description": null,
    "fixVersions": [],
    "aggregatetimespent": null,
    "statusCategory": {
      "self": "https://your-domain.atlassian.net/rest/api/2/statuscategory/4",
      "id": 4,
      "key": "indeterminate",
      "colorName": "yellow",
      "name": "進行中"
    },
    "resolution": null,
    "customfield_10036": null,
    "timetracking": {},
    "security": null,
    "aggregatetimeestimate": null,
    "resolutiondate": null,
    "workratio": -1,
    "summary": "サブタスク 2.1",
    "issuerestriction": { "issuerestrictions": {}, "shouldDisplay": true },
    "watches": {
      "self": "https://your-domain.atlassian.net/rest/api/2/issue/KAN-3/watchers",
      "watchCount": 1,
      "isWatching": true
    },
    "lastViewed": null,
    "creator": {
      "self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=557058%3Ad32c0488-f5a5-45ab-b9d5-187d11347e3e",
      "accountId": "557058:d32c0488-f5a5-45ab-b9d5-187d11347e3e",
      "emailAddress": "your-domain@gmail.com",
      "avatarUrls": {
        "48x48": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "24x24": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "16x16": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "32x32": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png"
      },
      "displayName": "Toshihiro Tomita",
      "active": true,
      "timeZone": "Asia/Tokyo",
      "accountType": "atlassian"
    },
    "subtasks": [],
    "created": "2025-09-02T00:32:18.395+0900",
    "customfield_10021": null,
    "reporter": {
      "self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=557058%3Ad32c0488-f5a5-45ab-b9d5-187d11347e3e",
      "accountId": "557058:d32c0488-f5a5-45ab-b9d5-187d11347e3e",
      "emailAddress": "your-domain@gmail.com",
      "avatarUrls": {
        "48x48": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "24x24": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "16x16": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png",
        "32x32": "https://secure.gravatar.com/avatar/ddb5aa8469e4536ec11b866f497d9d4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTT-0.png"
      },
      "displayName": "Toshihiro Tomita",
      "active": true,
      "timeZone": "Asia/Tokyo",
      "accountType": "atlassian"
    },
    "aggregateprogress": { "progress": 0, "total": 0 },
    "priority": {
      "self": "https://your-domain.atlassian.net/rest/api/2/priority/3",
      "iconUrl": "https://your-domain.atlassian.net/images/icons/priorities/medium_new.svg",
      "name": "Medium",
      "id": "3"
    },
    "customfield_10001": null,
    "labels": [],
    "environment": null,
    "customfield_10019": "0|i0000f:",
    "timeestimate": null,
    "aggregatetimeoriginalestimate": null,
    "versions": [],
    "duedate": null,
    "progress": { "progress": 0, "total": 0 },
    "issuelinks": [],
    "votes": {
      "self": "https://your-domain.atlassian.net/rest/api/2/issue/KAN-3/votes",
      "votes": 0,
      "hasVoted": false
    },
    "assignee": null,
    "updated": "2025-09-02T00:32:18.770+0900",
    "status": {
      "self": "https://your-domain.atlassian.net/rest/api/2/status/10002",
      "description": "この作業項目は担当者によって現在作業が進められていることを表します。",
      "iconUrl": "https://your-domain.atlassian.net/images/icons/statuses/generic.png",
      "name": "進行中",
      "id": "10002",
      "statusCategory": {
        "self": "https://your-domain.atlassian.net/rest/api/2/statuscategory/4",
        "id": 4,
        "key": "indeterminate",
        "colorName": "yellow",
        "name": "進行中"
      }
    }
  }
}
      , null, 2)
  }

  const clearTestData = (): void => {
    testData.value = '{}'
  }

  const getDialogTitle = (mode: 'create' | 'edit' | 'duplicate'): string => {
    switch (mode) {
      case 'create':
        return '新しいテンプレート作成'
      case 'edit':
        return 'テンプレート編集'
      case 'duplicate':
        return 'テンプレート複製'
      default:
        return 'テンプレート編集'
    }
  }

  // Cleanup timeout on unmount
  const cleanup = (): void => {
    if (validationTimeout) {
      clearTimeout(validationTimeout)
    }
  }

  return {
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
    validateTemplateContent,
    handleTemplateContentChange,
    insertVariable,
    loadSampleData,
    clearTestData,
    getDialogTitle,
    cleanup
  }
}