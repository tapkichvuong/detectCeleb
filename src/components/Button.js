import * as React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Button({onPress, icon, color, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button} disabled={disabled}>
      <Ionicons name={icon} size={60} color={disabled? '#7F7F7F':color? color:'#f1f1f1'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});