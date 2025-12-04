import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>{{projectName}}</h1>
      <p>{{projectDescription}}</p>
    </main>
  )
}
