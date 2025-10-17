<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="500"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6">
        <v-icon start color="error">mdi-alert-circle</v-icon>
        {{ $t('approval.rejectionConfirm') }}
      </v-card-title>
      
      <v-card-text>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ $t('approval.messages.rejectItems', { count: targetCount }) }}
        </v-alert>
        
        <v-textarea
          v-model="localReason"
          :label="$t('approval.rejectionReason')"
          :placeholder="$t('approval.rejectionReasonPlaceholder')"
          variant="outlined"
          rows="3"
          required
          :rules="[v => !!v || $t('approval.rejectionReasonRequired')]"
          @keydown.esc="handleCancel"
        />
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="handleCancel"
        >
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :disabled="!localReason"
          @click="handleConfirm"
        >
          {{ $t('approval.actions.reject') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  targetCount: number
  reason?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', reason: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  targetCount: 0,
  reason: ''
})

const emit = defineEmits<Emits>()

const localReason = ref(props.reason)

// Watch for changes to the reason prop
watch(() => props.reason, (newReason) => {
  localReason.value = newReason
})

// Watch for dialog open to reset reason
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    localReason.value = props.reason
  }
})

const handleConfirm = () => {
  if (localReason.value) {
    emit('confirm', localReason.value)
    localReason.value = ''
  }
}

const handleCancel = () => {
  localReason.value = ''
  emit('cancel')
  emit('update:modelValue', false)
}
</script>