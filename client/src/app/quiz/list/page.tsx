﻿use client
i m p o r t   R e a c t   f r o m   ' r e a c t ' ;  
 i m p o r t   L i n k   f r o m   ' n e x t / l i n k ' ;  
 i m p o r t   Q u i z C a r d   f r o m   ' @ / c o m p o n e n t s / q u i z / Q u i z C a r d ' ;  
 i m p o r t   {   u s e Q u i z C o n t e x t   }   f r o m   ' @ / c o n t e x t s / Q u i z C o n t e x t ' ;  
  
 e x p o r t   d e f a u l t   f u n c t i o n   Q u i z L i s t P a g e ( )   {  
     c o n s t   {   q u i z z e s ,   i s L o a d i n g ,   e r r o r ,   d e l e t e Q u i z   }   =   u s e Q u i z C o n t e x t ( ) ;  
  
     c o n s t   h a n d l e D e l e t e   =   a s y n c   ( i d :   s t r i n g )   = >   {  
         i f   ( c o n f i r m ( ' A r e   y o u   s u r e   y o u   w a n t   t o   d e l e t e   t h i s   q u i z ? ' ) )   {  
             a w a i t   d e l e t e Q u i z ( i d ) ;  
         }  
     } ;  
  
     i f   ( i s L o a d i n g )   {  
         r e t u r n   (  
             < d i v   c l a s s N a m e = " c o n t a i n e r   m x - a u t o   p x - 4   p y - 8 " >  
                 < d i v   c l a s s N a m e = " t e x t - c e n t e r " > L o a d i n g   q u i z z e s . . . < / d i v >  
             < / d i v >  
         ) ;  
     }  
  
     i f   ( e r r o r )   {  
         r e t u r n   (  
             < d i v   c l a s s N a m e = " c o n t a i n e r   m x - a u t o   p x - 4   p y - 8 " >  
                 < d i v   c l a s s N a m e = " t e x t - r e d - 6 0 0   t e x t - c e n t e r " > { e r r o r } < / d i v >  
             < / d i v >  
         ) ;  
     }  
  
     r e t u r n   (  
         < d i v   c l a s s N a m e = " c o n t a i n e r   m x - a u t o   p x - 4   p y - 8 " >  
             < d i v   c l a s s N a m e = " f l e x   j u s t i f y - b e t w e e n   i t e m s - c e n t e r   m b - 6 " >  
                 < h 1   c l a s s N a m e = " t e x t - 2 x l   f o n t - b o l d " > Q u i z   M a n a g e m e n t < / h 1 >  
                 < L i n k  
 